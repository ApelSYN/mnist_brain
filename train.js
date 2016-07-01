const brain = require('brain.js');
var net = new brain.NeuralNetwork();
const fs = require('fs');

const mnist = require('mnist');

const set = mnist.set(20000, 0);

const trainingSet = set.training;
//const testSet = set.test;

net.train(trainingSet,
    {
            errorThresh: 0.001,  // error threshold to reach
            iterations: 20000,   // maximum training iterations
            log: true,           // console.log() progress periodically
            logPeriod: 1,       // number of iterations between logging
            learningRate: 0.3    // learning rate
    }
);


let wstream = fs.createWriteStream('./data/mnistTrain.json');
wstream.write(JSON.stringify(net.toJSON(),null,2));
wstream.end();

console.log('MNIST dataset with Brain.js train done.')
