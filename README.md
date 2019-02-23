# sliding-puzzle-solver

A sliding puzzle solver written in Javascript using D3 for puzzle interactivity.

The goal of this project was to create a sliding puzzle solver that worked entirely in-browser and allowed users
to solve arbitrary external puzzles. To that end, users are able to upload and crop puzzle images and select
their dimensions to solve in-app. Once their puzzles are processed, users can rearrange the initial and goal puzzle states
to their liking before solving.

## Live Demo
https://alexyuisingwu.github.io/sliding-puzzle-solver/

## Getting Started
If you just want to play around with the app, head to the demo link above.

### Installation
Otherwise, you can download the project and run it locally.

```
git clone https://github.com/alexyuisingwu/sliding-puzzle-solver
```

You'll also want to use a local HTTP server to serve the directory. I recommend using Python if you have it installed, but any server should do.

Python 3
```
python3 -m http.server
```

Python 2
```
python -m SimpleHTTPServer
```

After that, just go to http://0.0.0.0:8000/ (or whatever port you specify in your local server) to start running the app.

### Modifying Code

If you want to modify code, you'll have to install [webpack](https://webpack.js.org/), which is used to bundle up scripts.

Scripts are stored in the /src directory and transformed through webpack into files in the /dist directory.

After you make a modification to any file in /src, use webpack to re-bundle the scripts.

You'll also need [npm](https://www.npmjs.com/) to to get all the dependencies you need. In the root directory, enter:
```
npm install
```

## Solver Details

### Solvability
Currently, this app can optimally solve puzzles whose dimensions add up to 7 or less (4x3, 5x2, etc.) within a second.
4x4 puzzles can also be solved within a few seconds, though initial download of database files may slow things down (assuming they are not cached).

The strategic solver can solve puzzles in linear time (usually within a few seconds for puzzles with triple digit tile counts). However, it is non-optimal and thus may produce solutions several times as long as the optimal solver. It's most useful as a visualization of a valid strategy for humans to solve sliding puzzles.

Times may vary depending on your machine and browser.

### Strategic Solver Strategy

The strategy the strategic solver uses to solve sliding puzzles is simple enough that a human can use it too.

First, the solver solves the rows of the puzzle until only 2 rows remain, moving from top to bottom first and then bottom to top (if the empty tile's goal position is not in the bottom 2 rows).

Each row is solved left to right, with tiles rotating around already solved tiles to avoid displacing them.

When the solver reaches the last tile of a row (tile "a" and "b"), it moves the tile "b" 2 spaces below its goal.
Tile "a" is then brought to the right (into the last column of the row), and tile "b" is brought up to just beneath it.
After both tiles are stacked up, the tiles can be rotated into the row by sliding first tile "a" then tile "b" into place.

After only 2 rows remain, the solver switches to solving columns, moving from left to right first and then right to left (if empty tile's goal position is not in the rightmost 2 columns).

Similarly, the 2 tiles in a column have to be rotated in (as one cannot place a tile without affecting the placement of tiles on at least 1 side of it). Let the top tile of a column be tile "a" and the bottom tile be tile "b".

Tile "a" is first placed in its correct position (the top of the column). Then, tile "b" is brought to 2 tiles to the right of tile "a". Tile "a" is now brought down 1 tile, and finally, tile "b" is brought left one tile and the tiles can be rotated in, tile "a" first and then tile "b".

When only a 2x2 unsolved square remains, the solver first solves the top left or bottom left tiles (depending on whether one tile is supposed to be empty in the goal state), and then solves the empty tile (placing it in its goal position). A human solver could simply solve any 2 tiles in the 2x2 puzzle (the above order is only due to implementation details).

### Search Algorithm
This app uses [IDA*](https://en.wikipedia.org/wiki/Iterative_deepening_A*) to find optimal solutions.

Previous versions also used A* for 3x3 and smaller puzzles. However, this feature was removed to clean up the code, as there was not much benefit to using it vs. IDA*.

While A* generally expands less nodes than IDA*, its memory costs balloon as puzzles sizes increase, and costly maintenance of large queues of unexpanded nodes quickly reduces its performance benefits. As IDA* has roughly the same performance on puzzles with smaller dimensions and vastly better performance for larger puzzles, IDA* is now used for all puzzles.

### Heuristics

#### Linear Conflict
The [Linear Conflict](https://www.sciencedirect.com/science/article/pii/002002559290070O) heuristic is used by default for all non-4x4 puzzles.

Essentially, this heuristic is an extension of the manhattan distance heuristic, accounting for interactions between tiles.

In more detail, this heuristic finds the tiles in each row and column that are in their goal row/column.
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

#### Pattern Databases

The [Pattern Database](https://www.sciencedirect.com/science/article/pii/S0004370201000923) heuristic is used for 4x4 puzzles. While the linear conflict heuristic can solve most 4x4 puzzles, solve-time can extend up to 2 minutes for some puzzles. The pattern database heuristic lowers average solve-time to only a few seconds (though initial download of database files slows down solve-time before they are cached).

Essentially, the pattern database heuristic divides the problem into smaller disjoint subproblems. For each subproblem (set of non-overlapping tiles), the minimum distance required to reach any tile configuration from the goal state is recorded as a heuristic value. The heuristic values for each subproblem are then summed to generate a heuristic value for the entire puzzle.

A 6-6-3 static partitioning is used here, as it strikes a good balance between database size (and thus download size) and solve-time.

See [this github project](https://github.com/alexyuisingwu/sliding-puzzle-database-generator) for the code that generated the pattern database partitions.

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
