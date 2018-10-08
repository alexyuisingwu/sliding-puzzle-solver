# sliding-puzzle-solver

A sliding puzzle solver written in Javascript using D3 for puzzle interactivity.

The goal of this project was to create a sliding puzzle solver that worked entirely in-browser and allowed users
to solve arbitrary external puzzles. To that end, users are able to upload and crop puzzle images and select
their dimensions to solve in-app. Once their puzzles are processed, users can rearrange the initial and goal puzzle states
to their liking before solving.

## Live Demo
https://alexyuisingwu.github.io/sliding-puzzle-solver/

**NOTE**: Currently a work in progress: things might change periodically.

## Solver Details

### Solvability
Currently, this app can optimally solve puzzles whose dimensions add up to 7 or less (4x3, 5x2, etc.) within a second.
4x4 puzzles can be solved within 2 minutes, 1 minute on average.

### Search Algorithm
This app uses 2 different search algorithms to solve puzzles: [A*](https://en.wikipedia.org/wiki/A*_search_algorithm) and 
[IDA*](https://en.wikipedia.org/wiki/Iterative_deepening_A*). While A* generally expands less nodes than IDA*, its memory
costs balloon as puzzles sizes increase, and costly maintenance of large queues of unexpanded nodes quickly reduces
its performance benefits. Therefore, it is only feasible to use A* for puzzles of size 3x3 or less. IDA*
is used for all puzzles with more than 9 tiles.

### Heuristics
Both search algorithms use the same heuristic: [Linear Conflict](https://www.sciencedirect.com/science/article/pii/002002559290070O).
Essentially, this heuristic finds the tiles in each row and column that are in their goal row/column.
Then, the number of conflicts between tiles that meet this criteria are counted within each row/column.

A conflict occurs when 2 tiles must move past one another to reach their goal positions.
For example, when goal = {1, 2, 3} and current state = {3, 1, 2}, tile 3 is in conflict with tiles 1 and 2
because 3 needs to move past both tiles to reach its goal state at the rightmost position.

Then, the number of tiles that need to be removed to eliminate all conflicts is counted. In the previous example,
only one tile (3) needs to be removed (tiles 1 and 2 don't need to move past each other to reach their goals).

For each removed tile, the heuristic value increases by 2, as 1 of the 2 tiles involved in a conflict
must move out of the way for the other tile to move past, and then move back into its original row/column.

This heuristic is combined additively with the Manhattan Distance heuristic (MD) to create a more informed heuristic, 
as the 2 heuristics do not overlap. MD simply sums the horizontal and vertical distance between every non-empty tile's
current and goal positions, as each tile must at least travel that distance to reach its goal.

### Optimizations

#### Heuristics
Heuristic calculation can be expensive, especially in the case of Linear Conflict (LC). Luckily, the original LC paper
mentions a few tricks to speed up calculation; namely, precomputation.

Heuristic values were precomputed for both Linear Conflict alone as well as Manhattan Distance.

The Manhattan Distance cache has two parts: 
1 maps (start, goal) tile pairs to precomputed Manhattan Distances, while another maps (start, goal, move) to changes in
Manhattan Distance from the specified tile move.

The Linear Conflict cache maps every possible permutation of tile rows/columns 
(only including tiles in their goal rows/columns) to their Linear Conflict values.

To further speed execution, after every tile movement, the heuristic value is updated based only on changed columns/rows 
and the previous heuristic value.

#### Misc
Further optimization strategies were taken from [Implementing Fast Heuristic Search Code](https://www.semanticscholar.org/paper/Implementing-Fast-Heuristic-Search-Code-Burns-Hatem/634f6b6354d459e28f56749051c93130f01ce653).

The first is operator pre-computation, where each possible empty tile position is mapped to the set of valid moves in that state.

The second optimization is in-place modification of grid state: because IDA* expands a continuous chain of nodes, only a single 
grid instance is needed. Instead of cloning grids on every move/node expansion, each node expansion can simply update the swapped tiles 
and empty tile position, reversing the transformation once it returns to its parent.  
