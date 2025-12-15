// src/ai/training/dataProcessor.ts
import csv from 'csv-parser'; // Change this line - remove the * as
import * as fs from 'fs';
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';

// ... rest of the file remains the same until the normalizeData function

function normalizeData(tensor: tf.Tensor2D): {
  normalizedTensor: tf.Tensor2D,
  min: tf.Tensor,
  max: tf.Tensor
} {
  const min = tensor.min(0);
  const max = tensor.max(0);
  const normalizedTensor = tensor.sub(min).div(max.sub(min));
  
  return {
    normalizedTensor: normalizedTensor as tf.Tensor2D,
    min,
    max
  };
}

// Update the code that uses normalizeData:
async function trainModel(data: TrainingData[]): Promise<void> {
  // ... previous code ...
  
  // Normalize features
  const { normalizedTensor: normalizedXs, min: inputMin, max: inputMax } = normalizeData(xs);
  const { normalizedTensor: normalizedYs, min: outputMin, max: outputMax } = normalizeData(ys);
  
  // ... rest of the function
}
