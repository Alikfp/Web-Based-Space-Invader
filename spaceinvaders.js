"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
function spaceinvaders(reset_call = false) {
    // Inside this function you will use the classes and functions 
    // from rx.js
    // to add visuals to the svg element in pong.html, animate them, and make them interactive.
    // Study and complete the tasks in observable exampels first to get ideas.
    // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
    // You will be marked on your functional programming style
    // as well as the functionality that you implement.
    // Document your code!  
    // Modularising in TS
    // Difficulty : shooting and movement speed
    // Fix the restart (clean the svg before restart)
    // compiling error
    // powerup for shields
    // combination bonus
    // Next level after victory
    // the following simply runs your pong function on window load.  Make sure to leave it in place.
    if (typeof window != 'undefined') {
        const run_the_game = () => {
            class Tick {
                constructor(elapsed) {
                    this.elapsed = elapsed;
                }
            }
            class Move {
                constructor(direction) {
                    this.direction = direction;
                }
            }
            class Shoot {
                constructor() { }
            }
            class Restart {
                constructor() { }
            }
            const Constants = {
                CANVAS_SIZE: 600,
                SHIP_BULLET_SPEED: new Vec(0, 4.5),
                ALIEN_BULLET_SIZE: new Vec(0, -2),
                SHIP_SIZE: 20,
                BULLET_SIZE: 5,
                START_TIME: 0,
                START_ALIEN_COUNT: 10,
                START_ALIEN_SIZE: 20,
                ALIEN_SHOOTING_INTERVAL: 200,
                START_SHIELD_COUNT: 0,
                SHIELD_UNIT_SIZE: 15,
                SHIELD_LENGTH: 5,
                SHIELD_WIDTH: 2,
                START_LIVES: 1
            };
            //-------------------------- BODY GENERATOR --------------------------//
            const createShieldUnit = (viewType) => (oid) => (time) => (radius) => (pos) => ({
                createTime: time,
                pos: pos,
                vel: Vec.Zero,
                radius: radius,
                id: viewType + oid,
                viewType: viewType
            });
            const startShieldCluster = (count) => (length) => (width) => [...Array(count * length * width)].map((_, i) => createShieldUnit("shield")(i)(Constants.START_TIME)(Constants.SHIELD_UNIT_SIZE)(new Vec(70 + (i % length) * 20, Constants.CANVAS_SIZE * 0.8 + (i % width) * 20).add(new Vec(Math.floor(i / (length * width)) * 185, 0))));
            const startShield = startShieldCluster(Constants.START_SHIELD_COUNT)(Constants.SHIELD_LENGTH)(Constants.SHIELD_WIDTH);
            function createBullet(s, shooter) {
                const d = Vec.unitVecInDirection(0); // always the same angle
                // ship bullet
                if (shooter.viewType === 'ship') {
                    return {
                        id: `bullet${s.objCount}`,
                        viewType: 'bullet',
                        radius: Constants.BULLET_SIZE,
                        pos: s.ship.pos.sub(new Vec(0, shooter.radius + 1)),
                        vel: Constants.SHIP_BULLET_SPEED,
                        createTime: s.time,
                    };
                    // Alien bullet
                }
                return {
                    id: `bullet${s.objCount}`,
                    viewType: 'bullet',
                    radius: Constants.BULLET_SIZE,
                    pos: shooter.pos.add(new Vec(0, shooter.radius + 3)),
                    vel: Constants.ALIEN_BULLET_SIZE,
                    createTime: s.time,
                };
            }
            const createAlien = (viewType) => (oid) => (time) => (radius) => (pos) => (vel) => ({
                createTime: time,
                pos: pos,
                vel: vel,
                radius: radius,
                id: viewType + oid,
                viewType: viewType
            });
            const startAliens = [...Array(Constants.START_ALIEN_COUNT)]
                .map((_, i) => createAlien("alien")(i)(Constants.START_TIME)(Constants.START_ALIEN_SIZE)(new Vec((30 + 60 * (i % 7)), 70 + Math.floor(i / 7) * 55))(new Vec(1, 0)));
            function createShip() {
                return {
                    id: 'ship',
                    viewType: 'ship',
                    pos: new Vec(Constants.CANVAS_SIZE / 2, 0.95 * Constants.CANVAS_SIZE),
                    vel: Vec.Zero,
                    radius: Constants.SHIP_SIZE,
                    createTime: 0
                };
            }
            //-------------------------- CONTROLLER --------------------------//
            const observeKey = (eventName, k, result) => rxjs_1.fromEvent(document, eventName)
                .pipe(operators_1.filter(({ code }) => code === k), operators_1.filter(({ repeat }) => !repeat), operators_1.map(result));
            const startLeftMove = observeKey('keydown', 'ArrowLeft', () => new Move(-2)), startRightMove = observeKey('keydown', 'ArrowRight', () => new Move(2)), stopLeftMove = observeKey('keyup', 'ArrowLeft', () => new Move(0)), stopRightMove = observeKey('keyup', 'ArrowRight', () => new Move(0)), shoot = observeKey('keydown', 'Space', () => new Shoot()), restart = observeKey('keydown', 'F1', () => new Restart());
            //---------------------------- STATE -----------------------------//
            const initialState = {
                time: 0,
                ship: createShip(),
                bullets: [],
                aliens: startAliens,
                exit: [],
                shields: startShield,
                objCount: 0,
                gameOver: false,
                score: 0,
                victory: false,
                lives: Constants.START_LIVES
            }, restartState = {
                ...initialState,
                restart: true
            };
            // check whether a body is going out of the frame or not
            const in_frame = (b) => b.pos.x + b.vel.x > (Constants.SHIP_SIZE) // going out of the Canvas (Left)
                && b.pos.x + b.vel.x < (Constants.CANVAS_SIZE - Constants.SHIP_SIZE); // going out of the Canvas(Right)
            // moving bullets and the ship
            const moveObj = (o, body_type) => body_type === 'bullet' ?
                { ...o,
                    pos: o.pos.sub(o.vel) }
                //ship movement
                : in_frame(o) ?
                    { ...o,
                        pos: o.pos.add(o.vel) }
                    : { ...o,
                        vel: Vec.Zero };
            function AlienMove(aliens) {
                // some funcitons required for figuring out when to bounce back
                const sudo_left = { id: '_', pos: new Vec(0, 0), vel: Vec.Zero }, sudo_right = { id: '_', pos: new Vec(Constants.CANVAS_SIZE, 0), vel: Vec.Zero }, most_right = (lst) => lst.reduce((max_body, val) => val.pos.x > max_body.pos.x ? val : max_body, sudo_left), most_left = (lst) => lst.reduce((min_body, val) => val.pos.x < min_body.pos.x ? val : min_body, sudo_right), bounce_back = !in_frame(most_right(aliens)) || !in_frame(most_left(aliens)), keep_moving = (b) => ({ ...b, pos: b.pos.add(b.vel) }), bounce_and_descend = (b) => ({ ...b, vel: new Vec(-b.vel.x, 0), pos: b.pos.sub(new Vec(b.vel.x, -10)) });
                // Whether it needs to bounce or not
                if (bounce_back) {
                    return aliens.map(bounce_and_descend);
                }
                else {
                    return aliens.map(keep_moving);
                }
            }
            const handleCollisions = (s) => {
                const bodiesCollided = ([a, b]) => a.pos.sub(b.pos).len() < a.radius + b.radius, shipCollisions = s.bullets.filter(r => bodiesCollided([s.ship, r])).length, allBulletsAndShields = flatMap(s.bullets, b => s.shields.map(r => [b, r])), allBulletsAndAliens = flatMap(s.bullets, b => s.aliens.map(r => [b, r])), allBulletsAndShip = s.bullets.map(b => [b, s.ship]), collidedBulletsAndAliens = allBulletsAndAliens.filter(bodiesCollided), collidedBulletsAndShields = allBulletsAndShields.filter(bodiesCollided), collidedBulletsAndShip = allBulletsAndShip.filter(bodiesCollided), collidedBullets = collidedBulletsAndAliens
                    .concat(collidedBulletsAndShields)
                    .concat(collidedBulletsAndShip)
                    .map(([bullet, _]) => bullet), collidedAliens = collidedBulletsAndAliens.map(([_, alien]) => alien), collidedShields = collidedBulletsAndShields.map(([_, alien]) => alien), landing = (b) => b.pos.y > Constants.CANVAS_SIZE - Constants.SHIP_SIZE * 6.5, alienLanding = s.aliens.filter(landing).length > 0;
                // Typing issue
                return {
                    ...s,
                    bullets: cut(s.bullets)(collidedBullets),
                    aliens: cut(s.aliens)(collidedAliens),
                    exit: s.exit.concat(collidedBullets, collidedAliens, collidedShields),
                    score: s.score + collidedAliens.length,
                    shields: cut(s.shields)(collidedShields),
                    gameOver: (s.lives - shipCollisions < 1) || alienLanding,
                    lives: s.lives - shipCollisions
                };
            };
            // Given the list of alien, figures out which ones are fronties (can shoot)
            function frontier_aliens(aliens) {
                const found = (arr, a) => arr.some(e => e === a), 
                //lists the x values of aliens columns
                alien_col_x = (arr) => arr.reduce((cols, a) => found(cols, a.pos.x) ? cols : cols.concat(a.pos.x), []), 
                //returns all the aliens in a particular column
                aliens_in_col = (arr, col_num) => arr.reduce((in_col, a) => a.pos.x === col_num ? in_col.concat(a) : in_col, []), 
                // returns the lowest alien, given an array of aliens in a column
                sudo_alien = { id: '_', pos: new Vec(0, 0), vel: Vec.Zero }, lowest_in_col = (arr) => arr.reduce((lowest, a) => a.pos.y > lowest.pos.y ? a : lowest, sudo_alien);
                return alien_col_x(aliens).map((val) => aliens_in_col(aliens, val)).flatMap(lowest_in_col);
            }
            const tick = (s, elapsed) => {
                const not = (f) => (x) => !f(x), expired = (b) => (b.pos.y) < 0 || (b.pos.y) > Constants.CANVAS_SIZE, // Bullets expire if they go beyond the canvas frame
                expiredBullets = s.bullets.filter(expired), 
                // initiate some alien bullets
                front_line_aliens = frontier_aliens(s.aliens), // lists frontienr aliens
                // Given the time elapsed, randomly picks one frontier alien to shoot
                alien_shooting = (time) => time % Constants.ALIEN_SHOOTING_INTERVAL === 0 && s.aliens.length > 0 ?
                    createBullet(s, front_line_aliens[(Math.floor(Math.random() * front_line_aliens.length))])
                    : [], activeBullets = s.bullets.filter(not(expired)).concat(alien_shooting(s.time));
                return handleCollisions({
                    ...s,
                    ship: moveObj(s.ship, 'ship'),
                    bullets: activeBullets.map(b => moveObj(b, 'bullet')),
                    aliens: AlienMove(s.aliens),
                    exit: expiredBullets,
                    objCount: s.objCount + 1,
                    time: elapsed,
                    victory: s.aliens.length === 0,
                    restart: false
                });
            };
            const reduceState = (s, e) => e instanceof Move ? { ...s,
                ship: { ...s.ship, vel: new Vec(e.direction, 0), restart: false }
            } : e instanceof Shoot ? { ...s,
                bullets: s.bullets.concat([createBullet(s, s.ship)]),
                objCount: s.objCount + 1,
                restart: false
            } : e instanceof Restart ?
                restartState
                : s.gameOver ?
                    s
                    : tick(s, e.elapsed);
            //---------------------------- VIEW -----------------------------//
            const attr = (e, o) => { for (const k in o)
                e.setAttribute(k, String(o[k])); };
            function updateView(s) {
                const svg = document.getElementById("canvas"), ship = document.getElementById("ship");
                // Moving the space ship
                ship.setAttribute('transform', `translate(${s.ship.pos.x},${s.ship.pos.y})`);
                // General body creator function 
                const updateBodyView = (b) => {
                    function createBodyView(b) {
                        if (b.viewType === 'shield') {
                            const v = document.createElementNS(svg.namespaceURI, 'rect');
                            attr(v, { id: b.id, x: b.pos.x, y: b.pos.y, width: b.radius, height: b.radius });
                            v.classList.add(b.viewType);
                            svg.appendChild(v);
                            return v;
                        }
                        else {
                            const v = document.createElementNS(svg.namespaceURI, 'ellipse');
                            attr(v, { id: b.id, rx: b.radius, ry: b.radius });
                            v.classList.add(b.viewType);
                            svg.appendChild(v);
                            return v;
                        }
                    }
                    const v = document.getElementById(b.id) || createBodyView(b);
                    attr(v, { cx: b.pos.x, cy: b.pos.y });
                };
                s.bullets.forEach(updateBodyView);
                s.aliens.forEach(updateBodyView);
                s.shields.forEach(updateBodyView);
                // remove the expired bullets
                s.exit.forEach(o => {
                    const v = document.getElementById(o.id);
                    if (v)
                        svg.removeChild(v);
                });
                //Score Display
                const score = document.getElementById('score_board');
                score.textContent = `Score : ${s.score}`;
                //Lives Display
                const lives = document.getElementById('health');
                lives.textContent = `Lives : ${s.lives}`;
                // Handles GameOver:
                if (s.gameOver) {
                    // check whether game over is already on
                    const gameOver_object = document.getElementById('Game Over Display');
                    if (!gameOver_object) {
                        // insert the game over text
                        const v = document.createElementNS(svg.namespaceURI, "text");
                        attr(v, {
                            id: 'Game Over Display',
                            x: Constants.CANVAS_SIZE / 6,
                            y: Constants.CANVAS_SIZE / 2,
                            class: "gameover"
                        });
                        v.textContent = "Game Over";
                        svg.appendChild(v);
                        // inserts the restart instruction
                        const res = document.createElementNS(svg.namespaceURI, "text");
                        attr(res, {
                            id: 'restart',
                            x: Constants.CANVAS_SIZE / 4.5,
                            y: Constants.CANVAS_SIZE / 1.7,
                            class: "instruction"
                        });
                        res.textContent = "Press F1 to restart the game!";
                        svg.appendChild(res);
                    }
                }
                // Handles Victory:
                if (s.victory) {
                    subscription.unsubscribe();
                    const v = document.createElementNS(svg.namespaceURI, "text");
                    attr(v, {
                        x: Constants.CANVAS_SIZE / 4.5,
                        y: Constants.CANVAS_SIZE / 2,
                        class: "Victory"
                    });
                    v.textContent = "VICTORY";
                    svg.appendChild(v);
                }
                if (s.restart) {
                    //clean the canvas
                    const bulletsOnCanvas = svg.getElementsByClassName('bullet'), gameOver = svg.getElementsByClassName('gameover'), instructions = svg.getElementsByClassName('instruction'), 
                    // gets the ids of a certain class
                    ID_getter = (col) => [...Array(col.length)].map((_, i) => col.item(i).id), remove_by_ID = (id) => svg.removeChild(document.getElementById(id)), bullet_ids = ID_getter(bulletsOnCanvas), gameover_ID = ID_getter(gameOver), instruction_IDs = ID_getter(instructions);
                    console.log(instruction_IDs);
                    // remove all the bullets
                    bullet_ids.forEach(remove_by_ID);
                    // remove Gameover
                    gameover_ID.forEach(remove_by_ID);
                    // remove any instructions left on the canvas
                    instruction_IDs.forEach(remove_by_ID);
                }
            }
            //---------------------------- SUBSCRIPTION -----------------------------//
            const subscription = rxjs_1.interval(10).pipe(operators_1.map(elapsed => new Tick(elapsed)), operators_1.merge(startLeftMove, startRightMove, stopLeftMove, stopRightMove, shoot, restart), operators_1.scan(reduceState, initialState))
                .subscribe(state => updateView(state));
        };
        window.onload = run_the_game;
    }
}
spaceinvaders();
/////////////////////////////////////////////////////////////////////
// Utility functions
// A simple immutable vector class
class Vec {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.add = (b) => new Vec(this.x + b.x, this.y + b.y);
        this.sub = (b) => this.add(b.scale(-1));
        this.len = () => Math.sqrt(this.x * this.x + this.y * this.y);
        this.scale = (s) => new Vec(this.x * s, this.y * s);
        this.ortho = () => new Vec(this.y, -this.x);
        this.rotate = (deg) => (rad => ((cos, sin, { x, y }) => new Vec(x * cos - y * sin, x * sin + y * cos))(Math.cos(rad), Math.sin(rad), this))(Math.PI * deg / 180);
    }
}
Vec.unitVecInDirection = (deg) => new Vec(0, -1).rotate(deg);
Vec.Zero = new Vec();
function flatMap(a, f) {
    return Array.prototype.concat(...a.map(f));
}
const exists = (val) => (arr) => arr.filter(e => val === e ? 1 : 0).length > 0, except = (eq) => (a) => (b) => a.filter(not(elem(eq)(b))), not = (f) => (x) => !f(x), elem = (eq) => (a) => (e) => a.findIndex(eq(e)) >= 0, cut = except((a) => (b) => a.id === b.id);
//# sourceMappingURL=spaceinvaders.js.map