window.addEventListener('load', function () {
    // get the canvas element and its context
    var canvas = document.getElementById('sketchpad'),
        context = canvas.getContext('2d'),
        canvasOffset = getOffsetSum(canvas),
        thumbnailCtx = document.getElementById('thumbnail').getContext("2d"),
        footprint = {
            width: 28,
            height: 28
        },
        isRecognized = false,
        zoom = 10,
        clearer = function clearer () {
            context.fillStyle = "white";
            context.fillRect(0,0,footprint.width*zoom,footprint.height*zoom);
            thumbnailCtx.fillStyle = "white";
            thumbnailCtx.fillRect(0,0,footprint.width,footprint.height);
            document.getElementById('result').innerText = '';
            isRecognized = false;
        };

    clearer();

    function getOffsetSum(elem) {
        var top=0, left=0
        while(elem) {
            top = top + parseInt(elem.offsetTop)
            left = left + parseInt(elem.offsetLeft)
            elem = elem.offsetParent
        }

        return {top: top, left: left}
    }

    // create a drawer which tracks touch movements
    var drawer = {
        isDrawing: false,
        touchstart: function (coors) {
            context.beginPath();
            context.lineWidth = 20;
            context.lineCap="round";
            context.moveTo(coors.x-canvasOffset.left, coors.y-canvasOffset.top);
            this.isDrawing = true;
        },
        touchmove: function (coors) {
            if (this.isDrawing) {
                if (isRecognized) {
                    clearer();
                }
                context.lineTo(coors.x-canvasOffset.left, coors.y-canvasOffset.top);
                context.stroke();
            }
        },
        touchend: function (coors) {
            if (this.isDrawing) {
                this.touchmove(coors);
                this.isDrawing = false;
            }
        }
    };
    // create a function to pass touch events and coordinates to drawer
    function draw(event) { 
        var type = null;
        // map mouse events to touch events
        switch(event.type){
            case "mousedown":
                    event.touches = [];
                    event.touches[0] = { 
                        pageX: event.pageX,
                        pageY: event.pageY
                    };
                    type = "touchstart";                  
            break;
            case "mousemove":                
                    event.touches = [];
                    event.touches[0] = { 
                        pageX: event.pageX,
                        pageY: event.pageY
                    };
                    type = "touchmove";                
            break;
            case "mouseup":                
                    event.touches = [];
                    event.touches[0] = { 
                        pageX: event.pageX,
                        pageY: event.pageY
                    };
                    type = "touchend";
            break;
        }    
        
        // touchend clear the touches[0], so we need to use changedTouches[0]
        var coors;
        if(event.type === "touchend") {
            coors = {
                x: event.changedTouches[0].pageX,
                y: event.changedTouches[0].pageY
            };
        }
        else {
            // get the touch coordinates
            coors = {
                x: event.touches[0].pageX,
                y: event.touches[0].pageY
            };
        }
        type = type || event.type
        // pass the coordinates to the appropriate handler
        drawer[type](coors);
    }
    
    // detect touch capabilities
    var touchAvailable = ('createTouch' in document) || ('ontouchstart' in window);
    
    // attach the touchstart, touchmove, touchend event listeners.
    if(touchAvailable){
        canvas.addEventListener('touchstart', draw, false);
        canvas.addEventListener('touchmove', draw, false);
        canvas.addEventListener('touchend', draw, false);        
    }    
    // attach the mousedown, mousemove, mouseup event listeners.
    else {
        canvas.addEventListener('mousedown', draw, false);
        canvas.addEventListener('mousemove', draw, false);
        canvas.addEventListener('mouseup', draw, false);
    }

    window.addEventListener("resize", function (event) {
        event.preventDefault();
        canvasOffset = getOffsetSum(canvas);
    }, false);

    // prevent elastic scrolling
    document.body.addEventListener('touchmove', function (event) {
        event.preventDefault();
    }, false); // end body.onTouchMove

    // Clear canvas
    document.getElementById('sketchClearButton').addEventListener('click', function (event) {
        event.preventDefault();
        clearer();
    }, false)

    // Number recognizer
    document.getElementById('sketchRecogniseButton').addEventListener('click', function (event) {
        event.preventDefault();
        if (isRecognized) return;

        var imgData = context.getImageData(0, 0, 280, 280),
            imgUtil = window["imgUtil"];
        
        grayscaleImg = imgUtil.imageDataToGrayscale(imgData);
        var boundingRectangle = imgUtil.getBoundingRectangle(grayscaleImg, 0.01);
        var trans = imgUtil.centerImage(grayscaleImg); // [dX, dY] to center of mass

        //console.log(grayscaleImg);
        //console.log(boundingRectangle);
        //console.log(trans);

        // copy image to hidden canvas, translate to center-of-mass, then
        // scale to fit into a 200x200 box (see MNIST calibration notes on
        // Yann LeCun's website)
        var canvasCopy = document.createElement("canvas");
        canvasCopy.width = imgData.width;
        canvasCopy.height = imgData.height;
        var copyCtx = canvasCopy.getContext("2d");
        var brW = boundingRectangle.maxX+1-boundingRectangle.minX;
        var brH = boundingRectangle.maxY+1-boundingRectangle.minY;
        var scaling = 190 / (brW>brH?brW:brH);
        // scale
        copyCtx.translate(canvas.width/2, canvas.height/2);
        copyCtx.scale(scaling, scaling);
        copyCtx.translate(-canvas.width/2, -canvas.height/2);
        // translate to center of mass
        copyCtx.translate(trans.transX, trans.transY);

        copyCtx.drawImage(context.canvas, 0, 0);

        // now bin image into 10x10 blocks (giving a 28x28 image)
        imgData = copyCtx.getImageData(0, 0, 280, 280);
        grayscaleImg = imgUtil.imageDataToGrayscale(imgData);
        console.log(grayscaleImg);

        var nnInput = new Array(784),  nnInput2 = [];
        for (var y = 0; y < 28; y++) {
            for (var x = 0; x < 28; x++) {
                var mean = 0;
                for (var v = 0; v < 10; v++) {
                    for (var h = 0; h < 10; h++) {
                        mean += grayscaleImg[y*10 + v][x*10 + h];
                    }
                }
                mean = (1 - mean / 100); // average and invert
                nnInput[x*28+y] = (mean - .5) / .5;
            }
        }

        var thumbnail =  thumbnailCtx.getImageData(0, 0, footprint.width, footprint.height);


        // for visualization/debugging: paint the input to the neural net.
        //if (document.getElementById('preprocessing').checked == true) {
        if (true) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(copyCtx.canvas, 0, 0);
            for (var y = 0; y < 28; y++) {
                for (var x = 0; x < 28; x++) {
                    var block = context.getImageData(x * 10, y * 10, 10, 10);
                    var newVal = 255 * (0.5 - nnInput[x*28+y]/2);
                    nnInput2.push(Math.round((255-newVal)/255*100)/100);
                    for (var i = 0; i < 4 * 10 * 10; i+=4) {
                        block.data[i] = newVal;
                        block.data[i+1] = newVal;
                        block.data[i+2] = newVal;
                        block.data[i+3] = 255;
                    }
                    context.putImageData(block, x * 10, y * 10);

                    thumbnail.data[(y*28 + x)*4] = newVal;
                    thumbnail.data[(y*28 + x)*4 + 1] = newVal;
                    thumbnail.data[(y*28 + x)*4 + 2] = newVal;
                    thumbnail.data[(y*28 + x)*4 + 3] = 255;
                }
            }
        }
        thumbnailCtx.putImageData(thumbnail, 0, 0);


        //console.log(nnInput2);
        var output = window["nn"](nnInput2);
        //console.log(output);
        maxIndex = 0;
        output.reduce(function(p,c,i){if(p<c) {maxIndex=i; return c;} else return p;});
        console.log('Detect1: '+maxIndex);
        document.getElementById('result').innerText = maxIndex.toString();
        isRecognized = true;

    }, false)



}, false); // end window.onLoad