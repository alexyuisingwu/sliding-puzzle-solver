import Puzzle from './sliding-puzzle-algorithms'

onmessage = e => {
	let puzzle = new Puzzle(...e.data);
	puzzle.solve().then(moves => postMessage(moves));
}