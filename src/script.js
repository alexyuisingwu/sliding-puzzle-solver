// TODO: consider adding togglable "track move" feature

// TODO: consider changing to vertical orientation if screen too narrow or input images are landscape orientation

// TODO: decrease resolution of pictures to make cropping and moving tiles faster
// TODO: consider cropping images for each tile and getting rid of svg-limit cropping for performance
    // testing required though: might be worse or about the same for most reasonably sized puzzles

// TODO: implement non-optimal solver for puzzles 4x4 and larger

// TODO: consider implementing "play" mode disabling drag/select and only allowing arrow key movement and change drag/click to animate moves to neighboring tiles

// just importing from cropperjs uses un-minified version
import Cropper from '../node_modules/cropperjs/dist/cropper.min.js'
import {Grid, StartGrid, GoalGrid} from './puzzle-graphic.js'
import '../node_modules/cropperjs/dist/cropper.min.css'
import Puzzle from './async-puzzle-solver'
import isURL from 'validator/lib/isURL'

// TODO: uglify+minify re-enable after finish

// TODO: reorganize: validation functions separate js file

// TODO: consider moving each page to separate js file, with page manager switching between them
// possibility: store image as blob in localStorage, then just link to puzzle page
// alternatively, look into postMessage between Windows

(() => {
    // proxy server used to circumvent blocking of cross-origin requests by CORS
    const CORS_API_URL = 'https://cors-anywhere-alexyuisingwu.herokuapp.com/';

    // TODO: consider commenting out to reduce heroku dyno use-time

    // request to wake up heroku server early
    // (free heroku hosting "sleeps" after 30 min. of disuse)
    // to avoid delay before user submits cross-origin image link
    fetch(CORS_API_URL, {method: 'HEAD', cache: 'no-store'});

    class Util {
        static hide(e) {
            e = e instanceof d3.selection ? e : d3.select(e);
            e.style('display', 'none');
        }

        static show(e) {
            e = e instanceof d3.selection ? e : d3.select(e);
            e.style('display', '')
        }

        static toggle(e) {
            e = e instanceof d3.selection ? e : d3.select(e);
            e.style('display', e.style('display') === 'none' ? '' : 'none');
        }
    };

    const container = d3.select('.container-fluid');

    const messages = container.select('#messages'),
          instructionDiv = messages.select('#instructions'),
          warningDiv = messages.select('#warning'),
          warningMessage = messages.select('#warning-message'),
          errorDiv = messages.select('#error'),
          errorMessage = messages.select('#error-message');

    const imageUploadPage = d3.select('#image-upload-page'),
          imageContainer = d3.select('#image-upload-container'),
          imageRow = d3.select('#image-row'),
          instructions = d3.select('#instructions');

    const puzzlePage = d3.select('#puzzle-page');


    //--------------------------------------------------------------------------------------------------------
    // IMAGE UPLOAD PAGE
    //--------------------------------------------------------------------------------------------------------

    const imageForm = d3.select('#image-form');
    const imgUrlInput = d3.select('#image-url'),
          imgFileInput = d3.select('#upload-img-input'),
          imgFeedback = d3.select('#image-url ~ .invalid-feedback');

    const img = d3.select('#uploaded-image');

    const cropper = new Cropper(img.node(), {
        viewMode: 2,
        guides: false,
        center: false,
        autoCropArea: 1,
        dragMode: 'move'
    });

    const puzzleConfigForm = d3.select('#puzzle-config-form');

    let rowSubmit = true,
        colSubmit = true;

    const rowInput = d3.select('#num-rows'),
          rowFeedback = d3.select('#num-rows ~ .invalid-feedback');

    const colInput = d3.select('#num-cols'),
          colFeedback = d3.select('#num-cols ~ .invalid-feedback');

    const cropButton = d3.select('#crop-image-button');

    rowInput.on('input', validateRows);
    colInput.on('input', validateColumns);

    imageForm.on('submit', () => {
        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    function validateRows() {
        // would be better if execution short-circuited but OK given low complexity of validation
        // possible implementation: function as class instead, with params in constructor
        // and execute() function to actually validate, called in processResponses()
        rowSubmit = processResponses([numberValidation(rowInput, rowFeedback), twoInputValidation()],
            rowInput, rowFeedback);

        cropButton.property('disabled', !rowSubmit || !colSubmit);
    }

    function validateColumns() {
        colSubmit = processResponses([numberValidation(colInput, colFeedback)], colInput, colFeedback);

        // called separately as change in status of twoInputValidation means numberValidation
        // needs to be checked to see what is displayed on row feedback
        validateRows();
    }

    // shows feedback for input based on responses [{status: 'valid'/'invalid'/'warning', message: '...'}, ...]
    // returns whether input validation allows submission
    function processResponses(responses, input, feedback) {
        let warning;
        for (let {status, message} of responses) {
            if (status === 'invalid') {
                showError(input, feedback, message);
                return false;
            } else if (status === 'warning') {
                // store instead of showing immediately to allow detection of errors in next responses
                warning = message;
            }
        }
        if (warning) {
            showWarning(input, feedback, warning);
            return true;
        }
        hideMessages(input, feedback);
        return true;
    }

    function showError(input, feedback, message) {
        input.classed('has-warning', false);
        input.classed('is-invalid', true);

        feedback.classed('warning-feedback', false);
        feedback.classed('invalid-feedback', true);
        feedback.text(message);
    }

    function showWarning(input, feedback, message) {
        input.classed('has-warning', true);
        input.classed('is-invalid', false);

        feedback.classed('warning-feedback', true);
        feedback.classed('invalid-feedback', false);
        feedback.text(message);
    }

    function hideMessages(input, feedback) {
        input.classed('is-invalid', false);
        input.classed('has-warning', false);

        feedback.classed('invalid-feedback', false);
        feedback.classed('warning-feedback', false);
        feedback.text('');
    }

    function twoInputValidation() {
        let numRows = +rowInput.property('value');
        let numCols = +colInput.property('value');

        if (numRows === numCols && numRows === 1) {

            return {status: 'invalid', message: 'Cannot create 1x1 puzzles'};
        }

        let numTiles = numCols * numRows;
        if (numTiles > 400) {

            return {status: 'invalid', message:
                'Cannot create puzzle with more than 400 tiles (may crash your browser)'};
        }

        if (numTiles > 16) {

            return {status: 'warning', message:
                'Caution: this site may not be able to optimally solve puzzles with more than 16 tiles'};
        }

        if ((numRows > 1 && numCols > 6) || (numCols > 1 && numRows > 6)) {

            return {status: 'warning', message:
                'Caution: this site may not be able to optimally solve 2D puzzles with a dimension\
                > 6'};
        }
        
        return {status: 'valid'};
    }

    function numberValidation(input, feedback) {
        let val = +input.property('value');

        if (!Number.isInteger(val) || val < 1) {
            return {status: 'invalid', message: 'Number must be positive integer'};
        }
        return {status: 'valid'};
    }

    let imageType = 'image/jpeg';

    function loadImageUrl(url, useProxy=false) {

        if (url === '') {
            hideMessages(imgUrlInput, imgFeedback);
            return;
        }

        if (!isURL(url, {require_protocol: true})) {
            if (isURL(url, {require_protocol: false})) {
                url = 'http://' + url;
            } else {
                showError(imgUrlInput, imgFeedback, 'URL is invalid');
                return;
            }
        }

        // TODO: consider adding loading indication in case image loading takes a while
        // (like when heroku cors server is first woken up)

        // NOTE: not checking for image url before fetching because
        // HTML standard doesn't specify accepted image formats, 
        // so can differ between browsers

        fetch(url, {
            mode: 'cors',
            credentials: 'omit'
        })
            .then(response => {
                // 404 errors (like for invalid urls) not thrown by fetch
                if (response.ok) {
                    if (!response.headers.get('content-type').includes('image')) {                        throw new Error('URL does not point to image');
                    }
                    return response.blob();
                }
                // url could be correct and still not be loaded
                // ex: url is for image gated behind login/other authentication
                throw new Error('Image could not be loaded');
            })
            .then(blob => {
                imageType = blob.type;
                cropper.replace(URL.createObjectURL(blob));
                hideMessages(imgUrlInput, imgFeedback);
            })
            .catch(error => {
                // TypeError thrown when network error or CORS issue is encountered
                if (useProxy || !(error instanceof TypeError)) {
                    showError(imgUrlInput, imgFeedback, 
                        `Image could not be loaded. If you are certain
                        the url is correct, try downloading the image and uploading using
                        the "browse" button instead.`);
                } else loadImageUrl(CORS_API_URL + url, true);
            });
    }


    imgUrlInput.on('input', function() {
        loadImageUrl(this.value);
    });

    imgFileInput.on('change', () => {
        imgUrlInput.property('value', '');

        const imgUpload = imgFileInput.property('files')[0];
        if (imgUpload.type.includes('image')) {
            imageType = imgUpload.type;
            cropper.replace(URL.createObjectURL(imgUpload));
            hideMessages(imgUrlInput, imgFeedback);
        } else {
            showError(imgUrlInput, imgFeedback, 'Uploaded file must be an image');
        }
    });


    puzzleConfigForm.on('submit', () => {
        d3.event.preventDefault();
        d3.event.stopPropagation();

        if (rowSubmit && colSubmit) {
            imageContainer.remove();
            let numRows = +rowInput.property('value');
            let numCols = +colInput.property('value');

            Util.hide(imageUploadPage);
            Util.show(puzzlePage);

            let {width, height} = cropper.getCropBoxData();

            cropper.getCroppedCanvas().toBlob(blob => {
                splitImage(URL.createObjectURL(blob), width, height, numRows, numCols);
            }, imageType);
        }
    });

    //--------------------------------------------------------------------------------------------------------
    // PUZZLE PAGE
    //--------------------------------------------------------------------------------------------------------

    // TODO: consider displaying loading animation in puzzle space
    // (large puzzles and/or images can take a second or so to load)
    function splitImage(src, width, height, numRows, numCols) {

        const strings = {
            errors: {
                unsolvable: 'Puzzle is unsolvable. Try swapping tiles in your goal and/or start state;\
                        simply sliding tiles around will not affect puzzle solvability.',
                iterationLimit: 'Puzzle took too long to solve; further solve-time could crash your browser.'
            },
            warnings: {
                solvability: 'Be careful when swapping and deleting tiles; not all puzzle-states are solvable.'
            }
        }

        warningMessage.text(strings.warnings.solvability);
        Util.show(warningDiv);

        const maxGridHeight = 110;
        const maxGridWidth = 110;

        let scale = Math.min(maxGridWidth / width, maxGridHeight / height);

        // preserves aspect ratio of cropped image, with largest dim set to max dim above
        let gridWidth = scale * width,
            gridHeight = scale * height;

        // TODO: consider setting height as function of viewport height (vh) and moving to html
        const viewBox = {x: 0, y: 0, width: 300, height: gridHeight + 30};

        // NOTE: height not set in svg as overwritten by viewBox height scaling to width
        const svg = d3.select('#puzzle-svg')
            .attr('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

        const gridPadding = (300 - gridWidth * 2) / 3;

        // NOTE: 0.5 positioning helps make outlines crisper (as coords map to pixel square intersections)
        // - also helps prevent noticeable outline darkening in outline coord overlap for same reason
        // - difference can be seen more easily when strokeWidth increased
        const startGrid = new StartGrid(svg, gridPadding, 20.5, numRows, numCols, src,
                                            {
                                                height: gridHeight,
                                                width: gridWidth
                                            }).draw();

        const goalGrid = new GoalGrid(svg, viewBox.width - gridPadding - gridWidth, 20.5, numRows, numCols, 
                                            {
                                                height: gridHeight,
                                                width: gridWidth
                                            }).draw();

        // TODO: consider enclosing number in svg with its own viewBox to simplify
        // ensures tile numbers stay within bounding box
        const tileNumberSize = Math.min(gridHeight / numRows / 2, gridWidth / numCols / 2);

        startGrid.tileNumbers.style('font-size', `${tileNumberSize}px`);
        goalGrid.tileNumbers.style('font-size', `${tileNumberSize}px`);

        // TODO: consider adding to svg enclosing both self and grid to allow easy movement
        // of both
        // NOTE: not inside Grid as not sure if want to display label with all Grids
        // Adding label would make tile coords a little more confusing
        const startLabel = startGrid.container.append('text')
            .attr('x', startGrid.x + startGrid.width / 2)
            .attr('y', startGrid.y - 5)
            .text('Start')
            .classed('grid-title', true);

        const goalLabel = goalGrid.container.append('text')
            .attr('x', goalGrid.x + goalGrid.width / 2)
            .attr('y', goalGrid.y - 5)
            .text('Goal')
            .classed('grid-title', true);

        const buttonRight = svg.append('image')
            .attr('x', startGrid.x + gridWidth + gridPadding / 2 - 8)
            .attr('y', '50%')
            .attr('width', 16)
            .attr('height', 16)
            .attr('href', 'icons/right-chevron.svg')
            .classed('puzzle-arrow', true)
            .on('click', () => {
                startGrid.cloneTilesTo(goalGrid);
                Util.hide(errorDiv);
                checkSolvability();
            });

        const buttonToolbar = puzzlePage.select('#puzzle-button-toolbar');

        const puzzleButtons = buttonToolbar.select('#puzzle-buttons');

        const overlayButtons = buttonToolbar.select('#overlay-buttons');

        const solutionPanel = puzzlePage.select('#solution-panel');

        const solutionPanelBody = solutionPanel.select('.card-body');

        const solvingOverlay = d3.select('#solving-overlay');

        const animatingMovesOverlay = d3.select('#animating-moves-overlay');

        const cancelSolvingButton = d3.select('#cancel-solving-button');

        // NOTE: assumes starting state is solvable
        const shuffleButton = puzzleButtons.select('#shuffle-button')
            .on('click', () => {
                startGrid.shuffle();
                Util.hide(errorDiv);
            });

        const solveOptionSelect = d3.select('#solve-option-select');

        const solveButton = puzzleButtons.select('#solve-button')
            .on('click', function() {
                Util.show(solvingOverlay);
                Util.hide(errorDiv);

                let solveOption = solveOptionSelect.property('value');
                let solver = solveOption === 'Strategically' ? 'strategic' : undefined;
                
                Puzzle.solve(
                    numRows, numCols, 
                    Grid.getArrayRepresentation(startGrid, goalGrid),
                    startGrid.emptyPos,
                    {
                        solver: solver,
                        cancelPromise: new Promise(resolve => cancelSolvingButton.on('click', resolve))
                    }
                ).then(ans => {
                    Util.hide(solvingOverlay);
                    Util.show(solutionPanel);
                    // disable puzzle interaction while animating solution
                    Util.show(animatingMovesOverlay);

                    return startGrid.animateMoves(ans, solutionPanelBody);
                }).then(() => {
                    Util.hide(animatingMovesOverlay);
                }).catch(e => {
                    Util.hide(solvingOverlay);
                    Util.hide(animatingMovesOverlay);

                    errorMessage.text(e.message);
                    Util.show(errorDiv);
                    errorDiv.node().scrollIntoView();
                });
        });

        const resetPuzzleButton = puzzleButtons.select('#reset-puzzle-button')
            .on('click', () => {
                startGrid.resetTiles();
                goalGrid.resetTiles();
                Util.hide(solutionPanel);
                solveButton.property('disabled', true);
                // switches mode to tile deletion mode
                if (toggleMouseModeButton.text() === 'Tile Deletion Mode') {
                    toggleMouseModeButton.node().click();
                }
                toggleMouseModeButton.property('disabled', true);
                shuffleButton.property('disabled', true);
                Util.hide(errorDiv);
            });

        const numberOverlayButton = overlayButtons.select('#number-overlay-button')
            .on('click', () => {
                startGrid.toggleNumberOverlay();
                goalGrid.toggleNumberOverlay();
                let text = numberOverlayButton.text() === 'Show Number Overlay' ?
                    'Hide Number Overlay' : 'Show Number Overlay';
                numberOverlayButton.text(text);
            });

        const toggleMouseModeButton = overlayButtons.select('#toggle-mouse-mode-button')
            .on('click', function () {
                startGrid.toggleTileOverlay();
                goalGrid.toggleTileOverlay();

                let button = d3.select(this);
                let text = button.text() === 'Tile Deletion Mode' ?
                     'Tile Selection Mode' : 'Tile Deletion Mode';

                button.text(text);

                startGrid.deselectAll();
                goalGrid.deselectAll();
            });

        // TODO: consider looking into drop handler instead of getting tile from (x, y) in Grid
        const dragHandler = d3.drag()
            .subject(function(d) {
                return {x: d.cell.x, y: d.cell.y}
            })
            // don't drag tile if in delete mode or tile is empty
            .filter(d => {
                return !d.grid.deleteOverlay && !d.grid.hasEmptyTile(d.tile);
            })
            .on('drag', function (d) {

                d3.select(this).classed('dragging', true);

                // NOTE: raise() executes in 'drag' rather than 'start' as appendChild (called by raise())
                // prevents call of click handler (undesirable, since 'start' is called on clicks)

                // NOTE: not as inefficient as it may seem, as function only moves container
                // if it is not last element in parent

                // moves container of tile to front so that dragged tile drawn above other puzzle
                d.grid.container.raise();

                // moves tile to front so drawn in front of other tiles
                d.tile.raise();

                d.grid.container.node().focus();

                d3.select(this)
                    .attr('x', d3.event.x)
                    .attr('y', d3.event.y);
            })
            // NOTE: d3 still calls start and end on click (fires before click handler)
            .on('end', function (d) {

                d3.select(this).classed('dragging', false);

                // return original image to starting position on release
                let tileContainer = d3.select(this)
                    .attr('x', d.cell.x)
                    .attr('y', d.cell.y);

                let [mouseX, mouseY] = d3.mouse(svg.node());

                if (!goalGrid.dropTile(tileContainer, mouseX, mouseY)) {
                    startGrid.dropTile(tileContainer, mouseX, mouseY);
                    checkSolvability();
                }

                checkSolvability();
            });

        startGrid.tileContainers.call(dragHandler);
        goalGrid.tileContainers.call(dragHandler);

        startGrid.tileContainers.on('click', function(d) {
            let result = startGrid.clickTile(this);

            if (result.method === 'delete') {
                goalGrid.deleteTileWithStartingTile(result.tile);
                toggleMouseModeButton.property('disabled', false);
                shuffleButton.property('disabled', false);


            } else if (result.method === 'select' && goalGrid.selectedTiles.size === 1) {

                let goalTile = goalGrid.selectedTiles.values().next().value;

                // empty tiles cannot be cloned to goal Tile
                if (!startGrid.hasEmptyTile(result.tile)) {
                    Grid.cloneTile(result.tile, goalTile);

                    goalGrid.deselectTile(goalTile);
                    startGrid.deselectTile(result.tile);
                }
                
            }

            checkSolvability();
        });

        goalGrid.tileContainers.on('click', function(d) {

            let result = goalGrid.clickTile(this);

            if (result.method === 'select' && startGrid.selectedTiles.size === 1) {

                let startTile = startGrid.selectedTiles.values().next().value;

                // empty tiles cannot be cloned to goal Tile
                if (!startGrid.hasEmptyTile(startTile)) {
                    Grid.cloneTile(startTile, result.tile);

                    goalGrid.deselectTile(result.tile);
                    startGrid.deselectTile(startTile);
                }
            }

            checkSolvability();
        });

        // TODO: consider allowing movement of selected tile (mainly for moving tiles in partially assigned goal)

        // TODO: consider deselecting tile if it's dragged or dropped onto

        // TODO: consider overwriting tile rather than swapping them when a tile with match is dragged to an occupied tile

        const arrowMovementHandler = function(selectedGrid) {

            let key = d3.event.key;
            
            const KEY_MAPPING = {
                'ArrowLeft': 'l',
                'ArrowRight': 'r',
                'ArrowUp': 'u',
                'ArrowDown': 'd',
                'w' : 'u',
                'a': 'l',
                's': 'd',
                'd': 'r'
            }

            let move = KEY_MAPPING[key];
            if (move) {
                // prevents arrow keys from scrolling screen
                d3.event.preventDefault();

                selectedGrid.animateMove(move);
            }
        }

        startGrid.container.on('keydown', arrowMovementHandler);
        goalGrid.container.on('keydown', arrowMovementHandler);

        function checkSolvability() {
            if (startGrid.emptyPos !== null && goalGrid.isFull()) {
                if (Grid.isSolvable(startGrid, goalGrid)) {
                    Util.hide(errorDiv);
                    solveButton.property('disabled', false);
                    return true;
                }
                errorMessage.text(strings.errors.unsolvable);
                Util.show(errorDiv);
                errorDiv.node().scrollIntoView();
            }
            
            solveButton.property('disabled', true);
            return false;
        }

    //--------------------------------------------------------------------------------------------------------
    }
})();
