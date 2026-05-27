import { RandomForestClassifier } from 'ml-random-forest';
const rf = new RandomForestClassifier({ seed: 42 });
const dummyX = [[30, 0, -1, 0.2], [70, 1, 1, 0.8], [50, 0, 0, 0.5], [60, 1, 0.5, 0.7]];
const dummyY = [0, 1, 0, 1];
rf.train(dummyX, dummyY);
console.log("Prediction 1:", rf.predict([[30, 0, -1, 0.2]]));
console.log("Prediction 2:", rf.predict([[70, 1, 1, 0.8]]));
