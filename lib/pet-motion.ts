import type {MotionStep} from './chudik-motion';
export const reactionDuration = (reaction: number) => reaction === 3 ? 8500 : 6000;
export const restingFrame = (reaction: number) => (({1: 6, 2: 11, 3: 14, 4: 2, 5: 3} as Record<number, number>)[reaction] ?? 0);

export function actionMotion(reaction: number, sequence = 0): readonly MotionStep[] {
  switch (reaction) {
    case 1: return [[0, 160], [4, 550], [5, 450], [6, 550], [5, 250], [6, 550], [5, 250], [6, 550], [7, 1100], [0, 1590]];
    case 2: return [[0, 200], [8, 450], [9, 300], [10, 500], [11, 550], [8, 350], [9, 250], [10, 500], [11, 1100], [0, 1800]];
    case 3: return [[0, 200], [12, 900], [13, 800], [14, 4600], [13, 500], [15, 1000], [0, 500]];
    case 4: return [[0, 200], [1, 500], [2, 1500], [sequence % 2 ? 1 : 3, 450], [2, 1300], [3, 850], [0, 1200]];
    case 5: return [[0, 200], [3, 700], [9, 400], [10, 400], [11, 700], [3, 1800], [0, 1800]];
    default: return [[0, 3200], [1, 120], [2, 130], [1, 100], [0, 2400]];
  }
}
