const brain = require('brain.js'),
      fs = require('fs'),
      mnist = require('mnist'),
      softmax = require('./lib/softmax');

var net = new brain.NeuralNetwork();

const set = mnist.set(0, 1);

//const trainingSet = set.training;
const testSet = set.test;

net.fromJSON(require('./data/mnistTrain'));


var output = net.run(testSet[0].input);


console.log(testSet[0].output);
console.log(softmax(output));

