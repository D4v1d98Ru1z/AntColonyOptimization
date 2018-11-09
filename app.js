// https://twitter.com/msvaljek
// https://msvaljek.blogspot.com/2013/08/canvas-ant-colony-optimization.html

// standard shim
window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

function randomInInterval(min, max) {
    return min + Math.round(Math.random() * (max - min));
}

// dom stuff
var canvas = document.getElementById('pathCanvas');
var antCanvas = document.getElementById('antsCanvas');

var fpsOut = document.getElementById('fps');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext('2d');
ctx.lineCap = 'round';

antCanvas.width = window.innerWidth;
antCanvas.height = window.innerHeight;
var antctx = antCanvas.getContext('2d');

var fps = 0,
    now, lastUpdate = (new Date()) * 1 - 1,
    fpsFilter = 50;

var ants = [];

function generateNewAnimation() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    antCanvas.width = window.innerWidth;
    antCanvas.height = window.innerHeight;

    pathSystem = new PathSystem();
    pathSystem.draw();

    ants = [];
    fps = 0;
    lastUpdate = (new Date()) * 1 - 1;
}

window.onresize = function () {
    generateNewAnimation();
};

var globals = {
    margin: 20,

    rows: 5,
    columns: 10,
    pathColor: '#5B3B82',
    pathLoopCycle: 120,

    bindJointsFromTopFlipFlop: false,

    antSpeed: 2,
    antColor: '#FFA6C4',
    antExploringColor: '#3785DE',
    antRadius: 5,
    antInterval: 30,

    explorationProbability: 0.5
};

var gui = new dat.GUI();
var f1 = gui.addFolder('Ant Appearance');
f1.addColor(globals, 'antColor').name('Ant Color');
f1.addColor(globals, 'antExploringColor').name('Exploring Ant');
f1.add(globals, 'antRadius').min(3).max(10).step(1).name('Ant Size');
f1.open();

var f2 = gui.addFolder('Colony optimization parameters');
f2.add(globals, 'antSpeed').min(0.5).max(10).step(0.5).name('Ant Speed');
f2.add(globals, 'antInterval').min(5).max(1000).step(1).name('New Ant Interval');
f2.add(globals, 'explorationProbability').min(0).max(0.8).step(0.01).name('Exploring %');
f2.open();

var f3 = gui.addFolder('Path parameters');
f3.addColor(globals, 'pathColor').name('Path Color');
f3.add(globals, 'rows').min(5).max(15).step(1).name('Max Path Rows').onFinishChange(generateNewAnimation);
f3.add(globals, 'columns').min(5).max(20).step(1).name('Max Path Cols').onFinishChange(generateNewAnimation);
f3.add(window, 'generateNewAnimation').name('Generate New');
f3.close();

var Joint = function (x, y, id) {
    this.x = x;
    this.y = y;

    this.connections = [];
    this.selections = [0, 0];

    // just to make the graph creation easier
    this.id = id;
};

var DrawPath = function (x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
};
DrawPath.prototype.getKey = function () {
    return this.x1 + '_' + this.y1 + '_' + this.x2 + '_' + this.y2;
};

var PathSystem = function () {
    var canvasYHalf = Math.round(canvas.height / 2);

    this.head = new Joint(globals.margin, canvasYHalf);

    var jointsBefore = [this.head];
    var newJoints = [];
    this.drawingMap = [];

    var dX = Math.round((canvas.width - 2 * globals.margin) / (globals.columns + 1));
    var dY = Math.round((canvas.height - 2 * globals.margin) / (globals.rows + 1));

    var i, k;

    for (var x = 0; x < globals.columns; x++) {
        var possibleNodes = [];
        for (var y = 0; y < globals.rows; y++) {
            var id = y;
            possibleNodes[y] = new Joint(dX + x * dX, dY + y * dY, id);
        }
        var selection;
        var newConnectedNodes = [];
        // flip flop to start binding from top or bottom (makes the grap look more random)
        globals.bindJointsFromTopFlipFlop = !globals.bindJointsFromTopFlipFlop;
        if (globals.bindJointsFromTopFlipFlop) {
            // bind from top
            var minPossible = 0;
            for (i = 0; i < jointsBefore.length; i++) {
                selection = randomInInterval(minPossible, possibleNodes.length - 1);
                if (selection > minPossible) {
                    minPossible = selection;
                }
                jointsBefore[i].connections[0] = possibleNodes[selection];
                newConnectedNodes[selection] = true;

                selection = randomInInterval(minPossible, possibleNodes.length - 1);
                if (selection > minPossible) {
                    minPossible = selection;
                }
                if (jointsBefore[i].connections[0].id !== selection) {
                    jointsBefore[i].connections[1] = possibleNodes[selection];
                    newConnectedNodes[selection] = true;
                }
            }
        } else {
            // bind from bottom
            var maxPossible = possibleNodes.length - 1;
            for (i = jointsBefore.length - 1; i >= 0; i--) {
                selection = randomInInterval(0, maxPossible);
                if (selection < maxPossible) {
                    maxPossible = selection;
                }
                jointsBefore[i].connections[0] = possibleNodes[selection];
                newConnectedNodes[selection] = true;

                selection = randomInInterval(0, maxPossible);
                if (selection < maxPossible) {
                    maxPossible = selection;
                }
                if (jointsBefore[i].connections[0].id !== selection) {
                    jointsBefore[i].connections[1] = possibleNodes[selection];
                    newConnectedNodes[selection] = true;
                }
            }
        }

        jointsBefore = [];
        for (k = 0; k < newConnectedNodes.length; k++) {
            if (newConnectedNodes[k] === true) {
                jointsBefore.push(possibleNodes[k]);
            }
        }
    }

    var tail = new Joint(canvas.width - globals.margin, canvasYHalf);

    for (k = 0; k < jointsBefore.length; k++) {
        jointsBefore[k].connections[0] = tail;
    }
};
PathSystem.prototype.mapPathConnections = function (joint) {
    var drawPath;
    if (joint.connections.length > 0) {
        drawPath = new DrawPath(joint.x, joint.y, joint.connections[0].x, joint.connections[0].y);
        this.drawingMap[drawPath.getKey()] = drawPath;

        this.mapPathConnections(joint.connections[0]);

        if (joint.connections.length == 2) {
            drawPath = new DrawPath(joint.x, joint.y, joint.connections[1].x, joint.connections[1].y);
            this.drawingMap[drawPath.getKey()] = drawPath;

            this.mapPathConnections(joint.connections[1]);
        }
    }
};
PathSystem.prototype.draw = function () {

    if (this.drawingMap.length === 0) {
        this.mapPathConnections(this.head);
    }

    ctx.strokeStyle = globals.pathColor;

    var drawedPath;

    for (var key in this.drawingMap) {

        drawedPath = this.drawingMap[key];

        ctx.moveTo(drawedPath.x1, drawedPath.y1);
        ctx.lineTo(drawedPath.x2, drawedPath.y2);
        ctx.stroke();
    }
};

var pathSystem = new PathSystem();
pathSystem.draw();

var Ant = function (joint) {
    this.x = joint.x;
    this.y = joint.y;
    this.selectDestination(joint);

    this.exploring = false;
    this.reachedEnd = false;
};
Ant.prototype.selectDestination = function (joint) {

    this.exploring = false;

    if (joint && joint.connections.length > 0) {

        var selectedNode;

        if (joint.connections.length > 1) {
            if (Math.random() > globals.explorationProbability) {
                selectedNode = joint.selections[0] >= joint.selections[1] ? 0 : 1;
            } else {
                this.exploring = true;
                selectedNode = joint.selections[0] <= joint.selections[1] ? 0 : 1;
            }
        } else {
            selectedNode = 0;
        }

        this.destination = joint.connections[selectedNode];
        joint.selections[selectedNode]++;
        this.orientToPoint(this.destination);
    } else {
        this.reachedEnd = true;
    }
};
Ant.prototype.orientToPoint = function (dot) {
    var dy = (dot.y - this.y);
    var dx = (dot.x - this.x);
    this.angle = Math.atan2(dy, dx);
};
Ant.prototype.draw = function () {
    if (!this.reachedEnd) {
        var dx = globals.antSpeed * Math.cos(this.angle);
        var dy = globals.antSpeed * Math.sin(this.angle);
        if (this.x + dx > this.destination.x) {
            this.selectDestination(this.destination);
        } else {
            this.x += dx;
            this.y += dy;
        }

        antctx.fillStyle = this.exploring ? globals.antExploringColor : globals.antColor;
        antctx.beginPath();
        antctx.arc(this.x, this.y, globals.antRadius, 0, 2 * Math.PI);
        antctx.fill();
    }
};

var antCounter = 0;
var pathDrawCounter = 0;

ants.push(new Ant(pathSystem.head));

(function animloop() {
    requestAnimFrame(animloop);

    antCounter++;
    pathDrawCounter++;

    if (pathDrawCounter >= globals.pathLoopCycle) {
        pathSystem.draw();
        pathDrawCounter = 0;
    }

    if (antCounter >= globals.antInterval) {
        ants.push(new Ant(pathSystem.head));
        antCounter = 0;
    }

    antctx.clearRect(0, 0, antCanvas.width, antCanvas.height);

    for (var ai = 0; ai < ants.length; ai++) {
        if (ants[ai].reachedEnd) {
            ants.splice(ai, 1);
        } else {
            ants[ai].draw();
        }
    }

    var thisFrameFPS = 1000 / ((now = new Date()) - lastUpdate);
    fps += (thisFrameFPS - fps) / fpsFilter;
    lastUpdate = now;
})();

setInterval(function () {
    fpsOut.innerHTML = fps.toFixed(1) + " fps";
}, 1000);