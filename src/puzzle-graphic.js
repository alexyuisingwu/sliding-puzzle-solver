// TODO: consider making Puzzle (driver for both grids) a separate class from script.js to make code cleaner

// TODO: consider making minimum tile size (based on when hard to click and hard to read number overlay)

// TODO: move all move related functionality in all files to separate file
class Move {

    static getFullName(move) {
        const NAME_MAPPING = {
            'l': 'left',
            'r': 'right',
            'u': 'up',
            'd': 'down'
        }
        return NAME_MAPPING[move];
    }
}

// TODO: consider moving to separate file or algorithms file
class Util {

    // counts number inversions in array ignoring emptyPos index
    // NOTE: # inversions can = 0 without being at goal state because emptyPos not considered
    static countInversions(arr) {

        return Util.mergeSort(arr);
    }

    static mergeSort(arr) {
        return Util._mergeSort(
            Uint16Array.from(arr), 
            new Uint16Array(arr.length),
            0, arr.length - 1
        );
    }

    // temp is auxiliary memory for _mergeSort (sorted elements get stored there)
    // temp passed between calls to reduce memory allocation
    // (not strictly necessary, could just make new [] in _merge())
    // WARNING: arr and temp are both modified by _mergeSort()
    static _mergeSort(arr, temp, left, right) {
        let numInversions = 0;

        if (right > left) {
            let mid = Math.floor((left + right) / 2);

            numInversions += Util._mergeSort(arr, temp, left, mid);
            numInversions += Util._mergeSort(arr, temp, mid + 1, right);

            numInversions += Util._merge(arr, temp, left, mid, right);
        }

        return numInversions;
    }

    static _merge(arr, temp, left, mid, right) {
        let numInversions = 0;

        // i and j move along 2 sorted arrays
        // k moves along output array
        let i = left,
            j = mid + 1,
            k = left;

        while (i <= mid && j <= right) {
            if (arr[i] <= arr[j]) {
                // NOTE: k++ returns k before incrementing, while ++k returns k after incrementing
                temp[k++] = arr[i++];
            } else {
                temp[k++] = arr[j++];

                // since left array is sorted, if arr[j] < arr[i], arr[j] < a[i to mid]
                numInversions += mid - i + 1;
            }
        }

        // adds remaining array values into temp (one array could run out before another)
        while (i <= mid) {
            temp[k++] = arr[i++];
        }

        while (j <= right) {
            temp[k++] = arr[j++];
        }

        for (i = left; i <= right; i++) {
            arr[i] = temp[i];
        }

        return numInversions;
    }
}

class Grid {
    constructor(parent, x, y, numRows, numCols,
                {height = 500, width = 500, imageSrc = null, hasTileUnderlay = false} = {}) {

        // parent svg for Grid to be placed in
        this.parent = parent instanceof d3.selection ? parent : d3.select(parent);

        this.x = x;
        this.y = y;

        this.numRows = numRows;
        this.numCols = numCols;

        this.height = height;
        this.width = width;

        this.imageSrc = imageSrc;

        this.hasTileUnderlay = hasTileUnderlay;

        this.tileHeight = height/numRows;
        this.tileWidth = width/numCols;

        // TODO: consider renaming to _emptyTiles (since contains tileContainer doms)
        this._emptyTiles = new Set();
        // NOTE: could be transformed into single variable tracking single selection
        // set used in case multiple selections are desired later
        this.selectedTiles = new Set();

        this.container = null;
        this.outline = null;
        this.tileContainers = null;
        this.tileImageContainers = null;
        this.tileOutlines = null;
        this.removeIcons = null;
        this.tileNumbers = null;
        this.tileOverlays = null;
        this.tileUnderlays = null;

        this.numberOverlay = false;
        // governs whether hovering over tile displays delete overlay option
        this.deleteOverlay = true;
    }

    // accepts tileContainer DOM/d3 selection, index 
    set emptyPos(d) {
        let tile = this._convertInputFormat(arguments);
        this._emptyTiles = new Set([tile.node()]);
    }

    get emptyPos() {
        return this._emptyTiles.size === 1 ? 
            d3.select(this._emptyTiles.values().next().value).datum().cell.ind : null;
    }

    get emptyTile() {
        return this._emptyTiles.size === 1 ? this._emptyTiles.values().next().value : null;
    }

    get numCells() {
        return this.numRows * this.numCols;
    }

    // hides tile EXCEPT for overlay
    // args = tileContainer DOM Element/d3 selection OR index
    hideTile(...args) {
        let tile = this._convertInputFormat(args);
        tile.select('.tile-image-container').style('visibility', 'hidden');
    }

    // shows tile EXCEPT for overlay
    // args = tileContainer DOM Element/d3 selection OR index
    showTile(...args) {
        let tile = this._convertInputFormat(args);
        tile.select('.tile-image-container').style('visibility', 'visible');
    }

    // args = tileContainer DOM Element/d3 selection OR index
    hideOverlay(...args) {
        let tile = this._convertInputFormat(args);
        tile.select('.tile-overlay')
            .classed('delete-overlay', false)
            .classed('select-overlay', false);
    }

    // args = tileContainer DOM Element/d3 selection OR index
    showOverlay(...args) {
        let tile = this._convertInputFormat(args);
        tile.select('.tile-overlay')
            .classed('delete-overlay', this.deleteOverlay)
            .classed('select-overlay', !this.deleteOverlay);
    }

    hideNumberOverlay() {
        this.tileNumberContainers.style('display', 'none');
        this.numberOverlay = false;
    }

    showNumberOverlay() {
        this.tileNumberContainers.style('display', '');
        this.numberOverlay = true;
    }

    showDeleteOverlay() {
        this.tileOverlays.classed('delete-overlay', true);
        this.tileOverlays.classed('select-overlay', false);
        this.deleteOverlay = true;
    }

    hideDeleteOverlay() {
        this.tileOverlays.classed('delete-overlay', false);
        this.tileOverlays.classed('select-overlay', true);
        this.deleteOverlay = false;
    }

    toggleTileOverlay() {
        this.deleteOverlay = !this.deleteOverlay;
    }

    toggleNumberOverlay() {
        this.numberOverlay ? this.hideNumberOverlay() : this.showNumberOverlay();
    }

    draw() {
        let data = this.generateGridData();

        this.container = this.parent
                            .datum(this)
                            .append('g')
                            .classed('grid-container', true)
                            .attr('tabindex', 0);


        this.outline = this.container.append('rect')
            .attr('x', this.x)
            .attr('y', this.y)
            .attr('width', this.width)
            .attr('height', this.height)
            .classed('puzzle-outline', true);

        if (this.hasTileUnderlay) {
            let underlayData = data.map(d => Object.assign(d.cell));
            
            // selects null so grid-outline doesn't get discarded in enter and updated with incorrect data
            // NOTE: not underneath tileContainers as underlay should not move with tile
            // also NOT underneath a parent <g> container of tileContainer as movement would
            // make underlay mismatch sibling tileContainer
            this.tileUnderlays = this.container.selectAll(null)
                                    .data(underlayData)
                                    .enter()
                                    .append('rect')
                                    .attr('x', d => d.x)
                                    .attr('y', d => d.y)
                                    .attr('width', this.tileWidth)
                                    .attr('height', this.tileHeight)
                                    .classed('tile-underlay', true);
        }

        this.tileContainers = this.container
            .selectAll('svg')
            .data(data)
            .enter()
            .append('svg')
            .attr('width', this.tileWidth)
            .attr('height', this.tileHeight)
            .attr('x', d => d.cell.x)
            .attr('y', d => d.cell.y)
            .classed('tile-container', true)
            .datum(function(d) {
                d.tile = d3.select(this);
                return d;
            });

        this.tileImageContainers = this.tileContainers
            .append('g')
            .classed('tile-image-container', true);

        if (this.imageSrc) {
            let images = this.tileImageContainers.append('image')
                .attr('width', this.width)
                .attr('height', this.height)
                .attr('x', d => d.img.offsetX)
                .attr('y', d => d.img.offsetY)
                .attr('xlink:href', this.imageSrc)
                .attr('preserveAspectRatio', 'none');
        } else {
            this.tileContainers.each(function(d) {d.grid.hideTile(this)});
            this._emptyTiles = new Set(this.tileContainers.nodes());
        }

        this.tileOutlines = this.tileImageContainers.append('rect')
            .attr('width', this.tileWidth)
            .attr('height', this.tileHeight)
            .classed('tile-outline', true);

        // functionality could be folded into tileOutlines, but distinct to reduce confusion
        // NOTE: NOT under tileImageContainer as visibility can be independent of tile image visibility
        this.tileOverlays = this.tileContainers.append('rect')
            .attr('width', this.tileWidth)
            .attr('height', this.tileHeight)
            .classed('tile-overlay', true)
            // NOTE: mouseover used instead of css hover to allow greater control
            .on('mouseover',  function(d) {
                let overlay = d3.select(this);
                overlay.classed('delete-overlay', d.grid.deleteOverlay && !d.grid.hasEmptyTile(d.tile));
                overlay.classed('select-overlay', !d.grid.deleteOverlay);
            })
            .on('mouseout', function(d) {
                let overlay = d3.select(this);
                overlay.classed('delete-overlay', false);

                // only remove select-overlay if tile not selected
                if (!d.grid.selectedTiles.has(d.tile.node())) {
                    overlay.classed('select-overlay', false);
                }
            });

        // number overlay hidden by default
        this.tileNumberContainers = this.tileImageContainers.append('g')
                                        .classed('tile-number-container', true)
                                        .style('display', this.numberOverlay ? '' : 'none');

        this.tileNumberBackground = this.tileNumberContainers.append('rect')
                                    .attr('width', this.tileWidth)
                                    .attr('height', this.tileHeight)
                                    .classed('tile-number-background', true);

        this.tileNumbers = this.tileNumberContainers.append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .text(d => d.cell.ind + 1)
            .classed('tile-number', true);

        return this;
    }

    // returns tile that is overlapping, or null if no tile found
    getOverlappingTile(x, y) {

        if (x < this.x || x > this.x + this.width || y < this.y || y > this.y + this.height) {
            return null;
        }
        let [row, col] = [this.getRowFromY(y), this.getColumnFromX(x)];

        let ind = this.getIndexFromTileCoord(row, col);

        let overlap = this.tileContainers.filter(d => d.cell.ind === ind);
        return overlap.empty() ? null : overlap;

    }

    // TODO: consolidate section into Move class
    // TODO: probably just have each form of data convert to selected intermediary to reduce function bloat
    getRowFromY(y) {
        return Math.floor((y - this.y) / this.tileHeight);
    }

    getRowFromIndex(ind) {
        return Math.floor(ind / this.numCols);
    }

    getColumnFromX(x) {
        return Math.floor((x - this.x) / this.tileWidth);
    }

    getColumnFromIndex(ind) {
        return ind % this.numCols;
    }

    getTileCoordFromIndex(ind) {
        return [this.getRowFromIndex(ind), this.getColumnFromIndex(ind)];
    }

    getIndexFromTileCoord(row, col) {
        return row * this.numCols + col;
    }

    getIndexFromCoord(x, y) {
        return this.getRowFromY(y) * this.numCols + this.getColumnFromX(x);
    }

    getXFromColumn(col) {
        return this.x + col * this.tileWidth;
    }

    getYFromRow(row) {
        return this.y + row * this.tileHeight;
    }

    getXFromIndex(ind) {
        return this.getColumnFromIndex(ind) * tileWidth;
    }

    getYFromIndex(ind) {
        return this.getRowFromIndex(ind) * tileHeight;
    }

    getCoordFromIndex(ind) {
        return [this.getXFromIndex(ind), this.getYFromIndex(ind)];
    }

    getCoordFromTileCoord(row, col) {
        return [this.getXFromColumn(col), this.getYFromRow(row)];
    }


    swapTileData(a, b) {
        let tile1 = this._convertInputFormat([a]);
        let tile2 = this._convertInputFormat([b]);

        let data1 = tile1.datum();
        let data2 = tile2.datum();

        [data1.cell, data2.cell] = [data2.cell, data1.cell];
    }

    // WARNING: Only works within same puzzle
    // swaps tileContainer selections
    // a, b can be flattened index, tileContainer DOM Element or d3 selection
    swapTile(a, b) {
        let tile1 = this._convertInputFormat([a]);
        let tile2 = this._convertInputFormat([b]);

        this.swapTileData(tile1, tile2);

        tile1.attr('x', d => d.cell.x).attr('y', d => d.cell.y);
        tile2.attr('x', d => d.cell.x).attr('y', d => d.cell.y);

    }

    // sets goal image to clone of start image
    // NOTE: duplicate tiles are not allowed in the same grid
    // if clone would cause duplicate, original tile instead moved to/swapped with goal tile
    // start, goal = tileContainer (d3.selection or DOM element)
    static cloneTile(start, goal) {

        let tileContainerStart = start instanceof d3.selection ? start : d3.select(start),
            tileContainerGoal = goal instanceof d3.selection ? goal : d3.select(goal);

        let startData = tileContainerStart.datum(),
            goalData = tileContainerGoal.datum();

        let startGrid = startData.grid,
            goalGrid = goalData.grid;

        let match = goalGrid.tileContainers.filter(d => 
            d.img !== undefined && 
            d.img.offsetX === startData.img.offsetX &&
            d.img.offsetY === startData.img.offsetY &&
            d.img.src === startData.img.src
        );

        if (!match.empty()) {
            goalGrid.swapTile(match, tileContainerGoal);
            return;
        }

        goalData.startTile = tileContainerStart;

        goalGrid.showTile(tileContainerGoal);
        let imageAtGoal = tileContainerGoal.select('image');

        if (imageAtGoal.empty()) {
            imageAtGoal = tileContainerGoal.insert('image', ':first-child')
            .attr('width', goalGrid.width)
            .attr('height', goalGrid.height);
        }

        goalData.img = Object.assign({}, startData.img);

        imageAtGoal.attr('x', d => d.img.offsetX)
            .attr('y', d => d.img.offsetY)
            .attr('xlink:href', d => d.img.src)
            .attr('preserveAspectRatio', 'none');

        tileContainerGoal
            .select('.tile-number')
            .text(d => d.startTile.datum().start.ind + 1);

        if (goalGrid.numberOverlay) {
            tileContainerGoal.select('.tile-number-container')
                .style('display', 'visible');
            }

        goalGrid._emptyTiles.delete(tileContainerGoal.node());
    }

    dropTile(tileContainerStart, x, y) {
        let overlap = this.getOverlappingTile(x, y);

        if (overlap) {
            Grid.cloneTile(tileContainerStart, overlap);
            return true;
        }
        return false;
    }

    isFull() {
        return this._emptyTiles.size === 1;
    }

    _generateGridDataHelper(row, col) {
        let [x, y] = this.getCoordFromTileCoord(row, col);
        let ind = this.getIndexFromTileCoord(row, col);
        // (x, y) = coords of grid cell
        let curr = {
            grid: this,
            cell : {
                x, 
                y,
                row,
                col,
                ind
            },
            
            start: {
                x: x, 
                y: y,
                row,
                col,
                ind
            }
        };
        if (this.imageSrc) {
            // (x, y) = coords of imageContainer
            curr.img = {
                // offset so that section of image shown corresponds to tile coordinates
                offsetX: -(x - this.x),
                offsetY: -(y - this.y),
                src: this.imageSrc,
            };
        }
        return curr;
    }

    generateGridData() {
        let data = [];
        for (let row = 0; row < this.numRows; row++) {
            for (let col = 0; col < this.numCols; col++) {
                data.push(this._generateGridDataHelper(row, col));
            }
        }
        return data;
    }


    getMoveInfo(move) {
        const moveDict = {
            l: {delta: -1, dx: -this.tileWidth, dy: 0},
            r: {delta: 1, dx: this.tileWidth, dy: 0},
            u: {delta: -this.numCols, dx: 0, dy: -this.tileHeight},
            d: {delta: this.numCols, dx: 0, dy: this.tileHeight}
        }
        return moveDict[move];

    }

    // TODO: disable buttons and tile selection/deletion during animation 
    // (and/or make them reset puzzle and stop animateMoves)
    // WARNING: will not work on incomplete grids (where not all images filled in and emptyPos specified)
    // moves = array of moves to animate ex: ['l', 'r', 'u', 'd', ...]
    // parent = optional parent element to insert list of moves in
    // durationPerMove = milliseconds it takes for single move to be animated
    animateMoves(moves, parent = null, durationPerMove=100) {
        let currPromise = null;

        let list, listItems, listItemsDOM;
        if (parent) {
            parent = parent instanceof d3.selection ? parent : d3.select(parent);
            
            list = parent.select('ol');
            if (list.empty()) {
                list = parent.append('ol')
                    .classed('list-group', true)
                    .classed('move-list', true);
            }
            
            // update data of existing elements
            let updateList = list.selectAll('li').data(moves);

            // enter/append missing list items
            let enterList = updateList.enter()
                .append('li')
                .classed('list-group-item', true)
                .classed('move-list-item', true);

            // all items in list update text to match new moves
            let listItems = updateList.merge(enterList)
                .text((d, i) => Move.getFullName(moves[i]));

            // extra list items with no associated moves removed
            updateList.exit().remove();

            listItemsDOM = listItems.nodes();
        }

        for (let i = 0; i < moves.length; i++) {
            let move = moves[i];
            let params = [move];

            if (parent) {
                params.push(listItemsDOM[i]);
            } else {
                params.push(null);
            }
            if (currPromise === null) {
                currPromise = this.animateMove(...params, durationPerMove);
            } else {
                try {
                    currPromise = currPromise.then(() => this.animateMove(...params, durationPerMove));
                } catch (error) {
                    // TODO: consider catching error silently to stop errors from piling up in console
                    // since erroneous key presses are expected
                    // alternatively, just return true/false from animateMove and be done with it
                    console.log(error);
                }
            }
        }
        return currPromise;
    }

    // TODO: consider using d3's transition syntax rather than Promise wrapping
    // pro: can probably use transition.interrupt for a "stop" feature
    // alternatively, consider using async/await

    // animates move and returns associated Transition Promise
    // move within {'l', 'r', 'd', 'u'}
    // listItem = <li> DOM element containing move string
    // - listItem highlighted when corresponding move is played
    // duration = milliseconds it takes to animate move
    animateMove(move, listItem = null, duration=100) {
        if (!this.canMove(move)) {
            throw new Error(`Invalid Move: ${move}`);
        }

        let moveInfo = this.getMoveInfo(move);

        return new Promise(resolve => {
            if (listItem) {
                listItem.classList.add('active-move');
                // TODO: reconsider whether to use (might hide tile sliding on certain screen sizes)
                listItem.scrollIntoView();
            }
            let movedTile = this.tileContainers
                .filter(d => d.cell.ind === this.emptyPos - moveInfo.delta);
            let emptyTile = this.tileContainers
                .filter(d => d.cell.ind === this.emptyPos);

            this.swapTileData(movedTile, emptyTile);
            emptyTile
                .attr('x', d => d.cell.x)
                .attr('y', d => d.cell.y);

            movedTile
                .transition()
                // TODO: decrease speed after testing
                .duration(duration)
                .attr('x', d => d.cell.x)
                .attr('y', d => d.cell.y)
                .on('end', () => {
                    if (listItem) listItem.classList.remove('active-move');
                    resolve();
                })
        });
    }

    canMove(move) {
        if (this._emptyTiles.size === this.numCells) {
            return false;
        }
        // TODO: consolidate with other move utility functions to separate (nested?) Move class
        const moveDict = {
            l: {dRow: 0, dCol: -1},
            r: {dRow: 0, dCol: 1},
            u: {dRow: -1, dCol: 0},
            d: {dRow: 1, dCol: 0}
        }

        let moveInfo = moveDict[move];

        let [row, col] = this.getTileCoordFromIndex(this.emptyPos);

        let movedTile = {row: row - moveInfo.dRow, col: col - moveInfo.dCol};

        return movedTile.row >= 0 && movedTile.row < this.numRows
            && movedTile.col >= 0 && movedTile.col < this.numCols;
    }

    // args = ind or row, col
    hasTileAt(...args) {
        if (args.length === 1) {
            let ind = args[0];
            return ind !== this.emptyPos && ind >= 0 && ind < this.numCells;
        }

        if (args.length === 2) {
            let [row, col] = args;
            return row >= 0 && row < this.numRows && col >= 0 && col < this.numCols;
        }
    }

    selectTile(...args) {
        let tile = this._convertInputFormat(args);
        let overlay = tile.select('.tile-overlay');

        this.selectedTiles.add(tile.node());
        overlay.classed('select-overlay', true);
    }

    deselectTile(...args) {
        let tile = this._convertInputFormat(args);
        let overlay = tile.select('.tile-overlay');

        this.selectedTiles.delete(tile.node());
        overlay.classed('select-overlay', false);
    }

    deselectAll() {
        let that = this;
        this.tileContainers.each(d => this.deselectTile(d.tile));
    }

    // toggles whether tile is selected or not
    // returns whether tile is selected or not after toggle
    // args = tileContainer DOM Element/d3 selection OR index
    toggleTileSelect(...args) {
        let tile = this._convertInputFormat(args);
        let overlay = tile.select('.tile-overlay');

        let selected = overlay.classed('select-overlay');
        if (selected) {
            this.selectedTiles.add(tile.node());
        } else {
            this.selectedTiles.delete(tile.node());
        }

        overlay.classed('select-overlay', !selected);

        return !selected;
    }

    // clicks specified tile
    // returns object with:
    // - 'method': delete/swap/deselect/select
    // - tile (sometimes): tileContainer selection deleted/deselected/selected
    // - tile1/tile2 (sometimes) : tiles swapped
    // args = tileContainer DOM Element/d3 selection OR index
    clickTile(...args) {
        let tileContainer = this._convertInputFormat(args);

        if (this.deleteOverlay) {
            this.deleteTile(tileContainer);
            this.hideOverlay(tileContainer);
            return {method: 'delete', tile: tileContainer};
        }

        let alreadySelectedTile = this.selectedTiles.values().next().value;
        if (alreadySelectedTile) {
            this.deselectTile(alreadySelectedTile);
            
            if (alreadySelectedTile !== tileContainer.node()) {
                this.swapTile(alreadySelectedTile, tileContainer);
                this.hideOverlay(tileContainer);
                return {method: 'swap', tile1: tileContainer, tile2: alreadySelectedTile};
            }
            return {method: 'deselect', tile: tileContainer};
        } else {

            this.selectTile(tileContainer);
            return {method: 'select', tile: tileContainer};
        }
        
    }

    hasEmptyTile(...args) {
        return this._emptyTiles.has(this._convertInputFormat(args).node());
    }
    
    // performs somewhat biased shuffle where shuffled state cannot equal original state
    // NOTE: assumes current state is solvable
    // see comment on isSolvable() for more explanation on how solvability guaranteed
    shuffle() {
        
        // shuffling for 1D puzzles randomly changes emptyPos and shifts tiles out of the way
        if (this.numRows === 1 || this.numCols === 1) {

            let newEmptyPos = this.emptyPos;
            // NOTE: while could loop infinitely, unlikely unless puzzle is 1x1, which is not allowed
            while (newEmptyPos === this.emptyPos) {
                newEmptyPos = Math.floor(Math.random() * this.numCells);
            }

            if (this.emptyPos < newEmptyPos) {
                for (let i = this.emptyPos; i < newEmptyPos; i++) {
                    this.swapTile(i, i + 1);
                }
            } else {
                for (let i = this.emptyPos; i > newEmptyPos; i--) {
                    this.swapTile(i, i - 1);
                }
            }
            
            return;
        }

        // array representation of puzzle assuming that start is goal state and shuffled state is start state
        let arr = this._fisherYatesShuffle();

        // if puzzle isn't solvable, a swap of horizontally neighboring tiles increases # inversions by 1
        // this makes puzzle solvable for all 2D puzzles (both dimensions > 1)
        if (!Grid._isSolvable(arr, this.emptyPos, this.numRows, this.numCols)) {
            let i, j;
            if (this.emptyPos < 2) {
                i = this.numCells - 2;
                j = this.numCells - 1;
            } else {
                i = 0;
                j = 1;
            }
            this.swapTile(i, j);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        // prevents same initial state from repeating 
        // NOTE: could loop infinitely, but unlikely unless puzzle is 1x1, which should be prevented
        if (arr.every((goalInd, ind) => goalInd === ind)) {
            this.shuffle();
            return;
        }
    }

    // shuffles puzzle randomly using the Fisher Yates/Knuth shuffling algorithm
    // returns array representation of puzzle assuming that starting position is goal state and
    // shuffled state is start state
    // WARNING: Is NOT guaranteed to return a solvable state
    _fisherYatesShuffle() {

        // arr becomes array representation of puzzle
        let arr = d3.range(this.numCells);
        // swaps each element with itself or an element after it
        for (let i = 0; i < arr.length - 1; i++) {
            let j = Math.floor(Math.random() * (arr.length - i) + i);

            [arr[i], arr[j]] = [arr[j], arr[i]];
            // could be made slightly faster by using swapData and only redrawing tiles at the end
            this.swapTile(i, j);
        }
        return arr;
    }

    // biased shuffle where shuffled state cannot equal original state using Sattolo's algorithm
    // each arr value will be in a different position than its initial position
    // WARNING: Is NOT guaranteed to return a solvable state
    _sattoloShuffle() {
        let arr = d3.range(this.numCells);
        // swaps each element with an element after it
        for (let i = 0; i < arr.length - 1; i++) {
            let j = Math.floor(Math.random() * (arr.length - i) + i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
            this.swapTile(i, j);
        }
        return arr;
    }

    // TODO: modify to support formats other than d3.selection
    _convertInputFormat(args, format='d3.selection') {
        if (args.length === 1) {
            let arg = args[0];
            if (arg instanceof d3.selection) return arg;
            if (arg instanceof Element) return d3.select(arg);
            // converts from index
            if (Number.isInteger(arg)) {
                let temp = this.tileContainers.filter(d => {
                    return d.cell.ind === arg;
                });
                return temp.empty() ? null : temp
            }
        }
        return null;
    }

    // returns flattened array (left to right, top to bottom) of array indices of tiles in the
    // goalGrid that correspond to the image ordering in the startGrid
    // ex: startGrid = [b, a, c], goalGrid = [a, b, c], return = [1, 0, 2]
    // explanation: b = goalGrid[1], a = goalGrid[0], c = goalGrid[2]
    static getArrayRepresentation(startGrid, goalGrid) {
        let output = [];
        goalGrid.tileContainers.data()
            .filter(d => d.img !== undefined)
            .forEach((d, i) => {
                output[d.startTile.datum().cell.ind] = d.cell.ind;
            }
        );

        output[startGrid.emptyPos] = goalGrid.emptyPos;

        return output;
    }

    // Explanation: picture puzzle as flattened array
    // inversion = pair of tiles in incorrect position (arr[i] > arr[j] && i < j)
    //
    // ex: [4, 2, 0, 5, 1] has 6 inversions
    // 4 > [2, 0, 1], 2 > [0, 1], 5 > [1]
    //
    // in the goal state, the array would read: [0, 1, 2, 3, 4, ...], with # inversions = 0
    //
    // sliding puzzle horizontally doesn't change # inversions
    // sliding puzzle vertically does
    //
    // if # cols = odd, sliding vertically changes # inversions by even number
    //      (sliding vertically changes relationship of tile with width - 1 tiles)
    //
    // therefore, solvable state must have even number of inversions in odd-col-puzzle
    //
    // if # cols = even, sliding vertically changes # inversions by odd number
    //      (width - 1 now odd)
    //
    // in goal state, # inversions = 0 and vertical distance between emptyPos's current and goal state = 0
    // in a vertical move, # inversions becomes odd and distance changes by 1 (becoming odd)
    // in a second vertical move, # inversions becomes even and distance changes by 1 (becoming even)
    //
    // therefore, in solvable state:
    //      # inversions = even and distance of emptyPos from goal position is even
    //          OR
    //      # inversions = odd and distance of emptyPos from goal position is odd
    //
    // if sliding puzzle is 1 dimensional (single row or column), only horizontal sliding is possible
    // therefore, # inversions cannot be changed, so puzzle only solvable if # inversions = 0.
    // alternatively, just check if array is sorted (excluding emptyPos) to see if solvable
    //
    // NOTE: # inversions can = 0 without being at goal state because it doesn't count emptyPos
    static isSolvable(startGrid, goalGrid) {
        if (startGrid.emptyPos === null || !goalGrid.isFull()) {
            return false;
        }

        let arr = Grid.getArrayRepresentation(startGrid, goalGrid);
        let emptyPos = startGrid.emptyPos;

        return Grid._isSolvable(arr, emptyPos, startGrid.numRows, startGrid.numCols);
    }

    // arr = array representation from getArrayRepresentation()
    // emptyPos = index of empty tile
    // numRows = number of rows of puzzle
    // numCols = number of columns of puzzle
    static _isSolvable(arr, emptyPos, numRows, numCols) {
        // if array is 1-D, sliding cannot change # inversions, so array must be sorted (excluding emptyPos)
        if (numCols === 1 || numRows === 1) {
            for (let i = 1; i < arr.length; i++) {
                if (i !== emptyPos && (i - 1) !== emptyPos && arr[i] < arr[i - 1]) return false;
            }
            return true;
        }

        let numInversions = Util.countInversions(arr.filter((d, i) => i != emptyPos));

        if (numCols % 2 === 1) {
            return numInversions % 2 === 0;
        }

        let row = Math.floor(emptyPos / numCols);
        let goalRow = Math.floor(arr[emptyPos] / numCols);

        return (numInversions % 2 === 0) === (Math.abs(row - goalRow) % 2 === 0);
    }

    // TODO: consider using custom function instead of cloneTile for better performance
    cloneTilesTo(goalGrid) {
        this.tileContainers
            .each(d => {
                if (!this.hasEmptyTile(d.tile)) {
                    let goalTile = goalGrid.tileContainers.filter(goalData => goalData.cell.ind === d.cell.ind);
                    Grid.cloneTile(d.tile, goalTile);
                }
            });
    }
}

class StartGrid extends Grid {
    constructor(parent, x, y, numRows, numCols, imageSrc, {height = 500, width = 500} = {}) {
        super(parent, x, y, numRows, numCols, {
            height, width, imageSrc, hasTileUnderlay: true
        });

    }

    resetTiles() {

        this.tileContainers
            .attr('x', d => {
                if (d.cell.ind === this.emptyPos) {

                    let tile = this._convertInputFormat([d.cell.ind]);
                    this.showTile(tile);
                }
                d.cell = Object.assign({}, d.start);
                return d.start.x;
            })
            .attr('y', d => d.start.y);
        this._emptyTiles = new Set();
    }

    // args = tileContainer DOM Element/d3 selection OR index
    deleteTile(...args) {
        let tile = this._convertInputFormat(args);
        if (this.emptyPos !== null) {
            this.showTile(this.emptyPos);
        }
        this.emptyPos = tile;
        this.hideTile(tile);
    }

}

class GoalGrid extends Grid {

    constructor(parent, x, y, numRows, numCols, {height = 500, width = 500} = {}) {
        super(parent, x, y, numRows, numCols, {
            height, width, hasTileUnderlay: true
        });
    }

    resetTiles() {
        this.tileContainers
            .attr('x', d => d.start.x)
            .attr('y', d => d.start.y)
            .each(d => this.hideTile(d.tile))
            .each(d => {
                d.cell = Object.assign({}, d.start);
                delete d.img;
            });

        this.tileContainers.select('image').remove();
        this._emptyTiles = new Set(this.tileContainers.nodes());
    }

    // args = tileContainer DOM Element/d3 selection OR index
    deleteTile(...args) {
        let tile = this._convertInputFormat(args);
        this._emptyTiles.add(tile.node());

        return this.deletetileContainer(tile);
    }

    // deletes tile with specified starting tileContainer (d3 selection)
    deleteTileWithStartingTile(tileContainerStart) {
        tileContainerStart = tileContainerStart instanceof d3.selection ? 
            tileContainerStart : d3.select(tileContainerStart);
        let tile = this.tileContainers.filter(d => 
            d.hasOwnProperty('startTile') && d.startTile.node() === tileContainerStart.node()
        );
        return this.deletetileContainer(tile);
    }

    deletetileContainer(tileContainer) {
        if (tileContainer === null || tileContainer.empty()) {
            return false;
        }
        let data = tileContainer.datum();

        delete data.img;
        tileContainer.select('image').remove();
        this.hideTile(tileContainer);
        this._emptyTiles.add(tileContainer.node());
        return true;
    }

}

export {Grid, StartGrid, GoalGrid}
