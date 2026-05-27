import { RandomForestClassifier } from 'ml-random-forest';

const rf = new RandomForestClassifier({ seed: 42, maxFeatures: 1, replacement: true, nEstimators: 10 });

const X = [
  [30, 0, -1, 0.2], 
  [70, 1, 1, 0.8], 
  [50, 0, 0, 0.5], 
  [60, 1, 0.5, 0.7],
  [40, 0, -0.5, 0.3],
  [80, 1, 1.2, 0.9]
];
const Y = ["bull", "bear", "bull", "bear", "bull", "bear"];

try {
  rf.train(X, Y);
  console.log("Success");
} catch(e) {
  console.error(e);
}
