import Puzzle from './sliding-puzzle-algorithms'

onmessage = e => {
	let puzzle = new Puzzle(...e.data);
	postMessage(puzzle.solve());
}