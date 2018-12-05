// NOTE: located in separate file from sliding-puzzle-algorithms to avoid problems with
// circular dependencies and webpack loaders (still relevant when using inline workers)

import PuzzleSolverWorker from './puzzle-solver.worker'

let puzzleWorker = new PuzzleSolverWorker();

class Puzzle {

    /**
     * solves Puzzle with parameters
     * @param numRows # rows in grid
     * @param numCols # columns in grid
     * @param tiles flattened array of tile ids corresponding to their locations in the unsolved puzzle
     * where ids = tile positions in the solved puzzle left to right, top to bottom, 0 indexed
     * - ex: startGrid = [b, a, c], goalGrid = [a, b, c], return = [1, 0, 2]
     * - explanation: b = goalGrid[1], a = goalGrid[0], c = goalGrid[2]
     * @param emptyPos position of empty tile in grid
     * @param heuristic heuristic used to determine how far grid is from goal state.
     * Default heuristic is Linear Conflict, possible values are 'MD' and 'LC'
     * @param solver solving algorithm to use ('IDA*' or 'A*')
     * corresponding with manhattan distance and linear conflict respectively
     * @param timeout milliseconds to wait before stopping solve attempt (default 120000)
     * timeout of "null" allows function to run without a time limit
     * (WARNING: could cause slowdown/crash if timeout too large)
     * @param cancelPromise promise that stops solve attempt upon resolve
     */
    static solve(numRows, numCols, tiles, emptyPos, 
        {heuristic = 'LC', solver = numRows * numCols > 9 ? 'IDA*' : 'A*', timeout = 120000,
        cancelPromise} = {}) {

        return new Promise((resolve, reject) => {

            let timeoutID;
            if (timeout !== null) {
                timeoutID = setTimeout(() => {

                    puzzleWorker.terminate();
                    puzzleWorker = new PuzzleSolverWorker();

                    reject(new Error(`Time limit (${timeout/1000} seconds) exceeded`));
                }, timeout);
            }

            puzzleWorker.onmessage = e => {
                if (timeoutID) clearTimeout(timeoutID);
                resolve(e.data);
            }

            if (cancelPromise) {
                cancelPromise.then(() => {
                    
                    puzzleWorker.terminate();
                    puzzleWorker = new PuzzleSolverWorker();

                    if (timeoutID) clearTimeout(timeoutID);
                    reject(new Error(`Puzzle solving cancelled`));
                });
            }

            puzzleWorker.postMessage([numRows, numCols, tiles, emptyPos, {heuristic, solver}]);
        });
        
    }
}

export default Puzzle;