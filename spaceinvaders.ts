import { fromEvent, interval,from, of, Subscription } from 'rxjs'; 
import { map, filter, scan, takeUntil, merge, buffer } from 'rxjs/operators';
import { BlockLike } from 'typescript';
function spaceinvaders() {
    
  /*
  *
  _________________________________________________________________________________________________
  NOTES : THE FRAMEWORK OF THIS GAME IS BUILT UPON ASTEROIDS BY https://tgdwyer.github.io/asteroids/ 
  _________________________________________________________________________________________________
  */
  if (typeof window != 'undefined'){
     const run_the_game = ()=>{

      class Tick { constructor(public readonly elapsed:number) {} }
      class Move { constructor(public readonly direction:number) {} }
      class Shoot { constructor() {} }
      class Restart {constructor() {}}
      class LevelUp {constructor() {}}

      type Body = Readonly<{
        id:string,
        pos:Vec 
        vel:Vec,
        viewType?:ViewType
        rotation?:number,
        radius?:number,
        createTime?:number,
      }>
      type State = Readonly<{
        time:number,
        ship:Body,
        bullets:Body[],
        aliens:ReadonlyArray<Body>,
        shields:ReadonlyArray<Body>,
        exit:ReadonlyArray<Body>,
        objCount:number,
        gameOver:boolean,
        score:number,
        victory:boolean,
        restart?:boolean,
        lives:number,
        level:number, // DIFFIVULTY LEVEL modified : alien shooting, alien count, alien speed
        levelUp:boolean,
        powerUps:ReadonlyArray<Body>
      }>
      type Event = 'keydown' | 'keyup'
      type Key = 'ArrowLeft' | 'ArrowRight' | 'Space' | 'F1' | 'F2'
      type ViewType = 'ship' | 'alien' | 'bullet' | 'shield' | 'Shield_PU'

      const 
      Constants = {
      CANVAS_SIZE : 600,
      SHIP_BULLET_SPEED: new Vec(0, -4.5),
      ALIEN_BULLET_SPEED: new Vec(0,2.5),
      SHIP_SIZE: 20,
      BULLET_SIZE:5,
      START_TIME:0,
      START_ALIEN_COUNT:14,
      START_ALIEN_SIZE:20,
      ALIEN_SHOOTING_INTERVAL : 200,
      START_SHIELD_COUNT: 3,
      SHIELD_UNIT_SIZE : 15,
      SHIELD_LENGTH:5,
      SHIELD_WIDTH:2,
      START_LIVES: 3
      }
      //-------------------------- BODY GENERATOR --------------------------//
      // creates a single shield unit/square
      const createShieldUnit = (viewType: ViewType)=> (oid:number)=> (time:number)=> (radius:number)=> (pos:Vec)=>
        <Body>{
          createTime: time,
          pos:pos,
          vel:Vec.Zero,
          radius: radius,
          id: viewType+oid,
          viewType: viewType
        };
      //creates an entire shield cluster/block 
      const startShieldCluster = (count) => (length:number) => (width:number) =>
        [...Array(count*length * width)].map((_,i) => createShieldUnit("shield")(i)
        (Constants.START_TIME)(Constants.SHIELD_UNIT_SIZE)
            (new Vec(70+(i%length)*20 , Constants.CANVAS_SIZE*0.8+(i%width)*20 ).add(new Vec(Math.floor(i/(length*width))*185, 0))))
      
      // starting shield
      const startShield = startShieldCluster(Constants.START_SHIELD_COUNT)(Constants.SHIELD_LENGTH )(Constants.SHIELD_WIDTH)
      
      //genrerates shield powerup
      function createShieldPowerUp(s:State, shooter:Body):Body {
        return {
          id: `PS${s.objCount}`,
          viewType: 'Shield_PU',
          radius: Constants.SHIELD_UNIT_SIZE,  
          pos: shooter.pos.add(new Vec(0, shooter.radius+3)),
          vel:Constants.ALIEN_BULLET_SPEED,
          createTime:s.time,
        } 
      }
      
      function createBullet(s:State, shooter:Body):Body {
        const d = Vec.unitVecInDirection(0); // always the same angle
        // ship bullet
         if (shooter.viewType === 'ship') {   
          return {
          id: `bullet${s.objCount}`,
          viewType: 'bullet',
          radius: Constants.BULLET_SIZE,  
          pos: s.ship.pos.sub(new Vec(0, shooter.radius+1)),
          vel:Constants.SHIP_BULLET_SPEED,
          createTime:s.time,
        } 
        // Alien bullet
      }
       return {
          id: `bullet${s.objCount}`,
          viewType: 'bullet',
          radius: Constants.BULLET_SIZE,  
          pos: shooter.pos.add(new Vec(0, shooter.radius+3)),
          vel:Constants.ALIEN_BULLET_SPEED,
          createTime:s.time,
        } 
      }
        
    const createAlien = (viewType: ViewType)=> (oid:number)=> (time:number)=> (radius:number)=> (pos:Vec)=> (vel:Vec)=>
      <Body>{
        createTime: time,
        pos:pos,
        vel:vel,
        radius: radius,
        id: viewType+oid,
        viewType: viewType
      };
    const startAliens = (level:number) => [...Array(Constants.START_ALIEN_COUNT + 7*(level-1))]
        .map((_,i)=>createAlien("alien")(i)
            (Constants.START_TIME)(Constants.START_ALIEN_SIZE)(new Vec((30+60*(i%7)),70 + Math.floor(i/7) * 55)) 
            (new Vec(1+(Math.floor(level-1)/2),0)))  
    
    function createShip():Body {
      return {
        id: 'ship',
        viewType: 'ship',
        pos: new Vec(Constants.CANVAS_SIZE/2, 0.95*Constants.CANVAS_SIZE),
        vel: Vec.Zero,
        radius:Constants.SHIP_SIZE,
        createTime:0
      }
    }
    //-------------------------- CONTROLLER --------------------------//
    const observeKey = <T>(eventName:Event, k:Key, result:()=>T)=>
      fromEvent<KeyboardEvent>(document,eventName)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result))
    
    const
    startLeftMove = observeKey('keydown','ArrowLeft',()=>new Move(-2)),
    startRightMove = observeKey('keydown','ArrowRight',()=>new Move(2)),
    stopLeftMove = observeKey('keyup','ArrowLeft',()=>new Move(0)),
    stopRightMove = observeKey('keyup','ArrowRight',()=>new Move(0)),
    shoot = observeKey('keydown','Space', ()=>new Shoot()),
    restart = observeKey('keydown','F1', ()=>new Restart()),
    nxtLevel = observeKey('keydown','F2', ()=>new LevelUp())
            
      //---------------------------- STATE -----------------------------//

      const initialState:State = {
        time:0,
        ship: createShip(),
        bullets: [],
        aliens: startAliens(1),
        exit: [],
        shields:startShield,
        objCount: 0,
        gameOver:false,
        score:0, 
        victory : false,
        lives : Constants.START_LIVES,
        level:1,
        levelUp:false,
        powerUps:[]
        
      },
       restartState:State = {
        ...initialState,
        restart:true,
        levelUp:false
      }

      // check whether a body is going out of the frame or not
      const in_frame = (b:Body) => 
      b.pos.x + b.vel.x > (Constants.SHIP_SIZE) // going out of the Canvas (Left)
       && b.pos.x + b.vel.x< (Constants.CANVAS_SIZE - Constants.SHIP_SIZE) // going out of the Canvas(Right)
      
      // moving bullets and the ship
      const moveObj = (o:Body, body_type:ViewType) =>
      body_type ==='bullet' || body_type ==='Shield_PU'? 
       {...o,
         pos:o.pos.add(o.vel)}

         //ship movement
       : in_frame(o)? 
          {...o,        //ships that are in the frame
            pos:o.pos.add(o.vel)}
          : {...o,      //ships that are going out of the frame
            vel:Vec.Zero}
    
    // Given the list of aliens, directs thier movement
     function AlienMove (aliens:ReadonlyArray<Body>) : ReadonlyArray<Body> {
      // some funcitons required for figuring out when to bounce back
       const 
       sudo_left = <Body>{id:'_', pos: new Vec(0,0), vel:Vec.Zero},
       sudo_right = <Body>{id:'_', pos: new Vec(Constants.CANVAS_SIZE,0), vel:Vec.Zero},
       most_right = (lst:ReadonlyArray<Body>) => lst.reduce((max_body,val) => val.pos.x > max_body.pos.x? val : max_body ,sudo_left),
       most_left = (lst:ReadonlyArray<Body>) => lst.reduce((min_body,val) => val.pos.x < min_body.pos.x? val : min_body ,sudo_right),
       bounce_back = !in_frame(most_right(aliens)) || !in_frame(most_left(aliens)),
       keep_moving = (b:Body) => <Body>{...b, pos:b.pos.add(b.vel)},
       bounce_and_descend = (b:Body) => <Body>{...b, vel:new Vec (-b.vel.x,0), pos:b.pos.sub(new Vec(b.vel.x, -10))}

      // Whether it needs to bounce or not
      if (bounce_back) {
        return aliens.map(bounce_and_descend)
      }
      else {
        return aliens.map(keep_moving)
      }

     }

      const handleCollisions = (s: State) => {
        // all possible colisions between aliens, bullets, ship, shield, powerups and etc
        const bodiesCollided = ([a, b]: [Body, Body]) =>a.pos.sub(b.pos).len() < a.radius + b.radius,
          shipCollisions = s.bullets.filter(r => bodiesCollided([s.ship, r])).length,
          allPowerUpsAndShip = s.powerUps.map<[Body, Body]>(p => [p, s.ship]),
          allBulletsAndShields = flatMap(s.bullets, b =>s.shields.map<[Body, Body]>(r => [b, r])),
          allPUsAndShields = flatMap(s.powerUps, b =>s.shields.map<[Body, Body]>(r => [b, r])),
          allBulletsAndAliens = flatMap(s.bullets, b =>s.aliens.map<[Body, Body]>(r => [b, r])),
          allBulletsAndShip = s.bullets.map<[Body, Body]>(b => [b, s.ship]),
          collidedBulletsAndAliens = allBulletsAndAliens.filter(bodiesCollided),
          collidedShieldPUAndShip = allPowerUpsAndShip.filter(bodiesCollided),
          collidedBulletsAndShields = allBulletsAndShields.filter(bodiesCollided),
          collidedPUsAndShields = allPUsAndShields.filter(bodiesCollided),
          collidedBulletsAndShip = allBulletsAndShip.filter(bodiesCollided),
          collidedBullets = collidedBulletsAndAliens
                            .concat(collidedBulletsAndShields)
                            .concat(collidedBulletsAndShip)
                            .map(([bullet, _]) => bullet),
          collidedAliens = collidedBulletsAndAliens.map(([_, alien]) => alien),
          collidedShields = collidedBulletsAndShields.map(([_, alien]) => alien),
          cut = except((a: Body) => (b: Body) => a.id === b.id),
          landing = (b:Body) => b.pos.y > Constants.CANVAS_SIZE - Constants.SHIP_SIZE*6.5,
          alienLanding = s.aliens.filter(landing).length > 0,
          gotShieldPU = collidedShieldPUAndShip.length > 0,
          collidedPUs = collidedPUsAndShields.concat(collidedShieldPUAndShip).map(([PU, _]) => PU)
          console.log(collidedPUs)


          
        // Typing issue
        return <State>{
          ...s,
          bullets: cut(s.bullets)(collidedBullets),
          aliens: cut(s.aliens)(collidedAliens),
          exit: s.exit.concat(collidedBullets, collidedAliens, collidedShields, collidedPUs),
          score: s.score + collidedAliens.length,
          shields: gotShieldPU? startShield : cut(s.shields)(collidedShields),
          gameOver: (s.lives - shipCollisions < 1) || alienLanding,
          lives: s.lives - shipCollisions,
          powerUps:cut(s.powerUps)(collidedPUs)
        };
      }

      // Given the list of alien, figures out which ones are fronties (can shoot)
      function frontier_aliens (aliens:ReadonlyArray<Body>) {
        const 
        found = (arr, a) => arr.some(e => e === a),
        //lists the x values of aliens columns
        alien_col_x = (arr) => 
          arr.reduce((cols,a) => found(cols,a.pos.x)? cols : cols.concat(a.pos.x) , []), 
        //returns all the aliens in a particular column
        aliens_in_col = (arr,col_num) => 
          arr.reduce((in_col, a) => a.pos.x === col_num? in_col.concat(a) : in_col , []),
        // returns the lowest alien, given an array of aliens in a column
        sudo_alien = <Body>{id:'_', pos: new Vec(0,0), vel:Vec.Zero},
        lowest_in_col = (arr) => arr.reduce((lowest, a) => a.pos.y > lowest.pos.y? a:lowest ,sudo_alien)
        return alien_col_x(aliens).map((val) => aliens_in_col(aliens,val)).flatMap(lowest_in_col)
      }

      const tick = (s:State,elapsed:number) => {
        const not = <T>(f:(x:T)=>boolean)=>(x:T)=>!f(x),
          expired = (b:Body)=>(b.pos.y) < 0 || (b.pos.y) > Constants.CANVAS_SIZE, // Bullets expire if they go beyond the canvas frame
          expiredPUs = s.powerUps.filter(expired),
          expiredBullets:Body[] = s.bullets.filter(expired),
          // initiate some alien bullets
          front_line_aliens = frontier_aliens(s.aliens),  // lists frontienr aliens
          // Given the time elapsed, randomly picks one frontier alien to shoot
          alien_shooting = (time:number) => 
            time % Math.floor(Constants.ALIEN_SHOOTING_INTERVAL/s.level) === 0 && s.aliens.length > 0 ?
            createBullet(s, front_line_aliens[(Math.floor(Math.random() * front_line_aliens.length))])
            : [],
            powerup_descent = (time:number) => 
            time % Math.floor(Constants.ALIEN_SHOOTING_INTERVAL*(5)) === 0 && s.aliens.length > 0 ?
            createShieldPowerUp(s, front_line_aliens[(Math.floor(Math.random() * front_line_aliens.length))])
            : <Body[]>[],
            activeBullets = s.bullets.filter(not(expired)).concat(alien_shooting(s.time)),
            activePowerUps = s.powerUps.filter(not(expired)).concat(powerup_descent(s.time))
            //console.log('before', activePowerUps[0])
            //console.log('after' ,activePowerUps.map(p => moveObj(p,'Shield_PU'))[0])
          return handleCollisions({
            ...s,
            ship: moveObj(s.ship,'ship'),
            bullets: activeBullets.map(b => moveObj(b,'bullet')),
            aliens: AlienMove(s.aliens),
            exit: expiredBullets.concat(expiredPUs),
            objCount : s.objCount + 1, 
            time: elapsed,
            victory: s.aliens.length === 0,
            restart:false, 
            levelUp:false,
            powerUps:activePowerUps.map(p => moveObj(p,'Shield_PU'))
          });
        }
      
      const 
      reduceState = (s:State, e:Move|Tick|Shoot|Restart|LevelUp)=>
      e instanceof Move ? {...s,
        ship : {...s.ship, vel:new Vec(e.direction, 0), restart:false, levelUp:false}

      } : e instanceof Shoot ? {...s,
        bullets: s.bullets.concat([createBullet(s, s.ship)]),
        objCount: s.objCount + 1,
        restart:false,
        levelUp:false
      } : e instanceof Restart?     //Restarts the game
      restartState
      : e instanceof LevelUp ?      //Level ups the game if the player has won
        s.victory ? 
        {...initialState,
        level: s.level + 1, 
        aliens:startAliens(s.level+1),
        levelUp:true
      } : {...s,time: s.time+1}
      : s.gameOver || s.victory ?
      s
      : tick(s,e.elapsed)
      
      //---------------------------- VIEW -----------------------------//
      
      // cleans up the canvas for restart and level up
      function svg_cleanUp (svg) {
        const 
        ID_getter = (col:HTMLCollection) => [...Array(col.length)].map((_,i) => col.item(i).id), 
        remove_by_ID = (id:string) => svg.removeChild(document.getElementById(id)),
        svg_class_remover = (class_name:string) => ID_getter(svg.getElementsByClassName(class_name)).forEach(remove_by_ID),
        removable_classes = ['bullet','alien','gameover','victory','instruction', 'Shield_PU']
        removable_classes.map(svg_class_remover)
      }

      // A general SVG text creator function
      const svg_text_creator = (svg) => (id:string)=>(x:number)=>(y:number)=>(cls:string)=>(content:string) =>
        {
          const attr = (e:Element, o:Object) =>
          {for(const k in o) e.setAttribute(k,String(o[k])) }
          const v = document.createElementNS(svg.namespaceURI, 'text')!;
          attr(v,{
            id: id,
            x: x,
            y: y,
            class: cls
          });
          v.textContent = content;
          svg.appendChild(v);
        }
      
      // attribute setter
      const attr = (e:Element, o:Object) =>
      { for(const k in o) e.setAttribute(k,String(o[k])) }
      
      // Updates the view of the game based on the current state
      // The only non-pure part of the code
      function updateView(s:State): void {
        const 
        svg = document.getElementById("canvas")!, 
        ship = document.getElementById("ship")!;
        // Moving the space ship
        ship.setAttribute('transform',
         `translate(${s.ship.pos.x},${s.ship.pos.y})`)
        
        // General body creator function 
        const updateBodyView = (b: Body) => {
          function createBodyView(b:Body) {
            //console.log(b.viewType)
            if (b.viewType === 'shield' ) {
              const v = document.createElementNS(svg.namespaceURI, 'rect')!;
              attr(v, { id: b.id , x:b.pos.x, y:b.pos.y,  width: b.radius, height: b.radius });
              v.classList.add(b.viewType);
              svg.appendChild(v);
              return v;
            }
            else if (b.viewType === 'Shield_PU' ) {
              const v = document.createElementNS(svg.namespaceURI, 'rect')!;
              attr(v, { id: b.id, width: b.radius, height: b.radius });
              v.classList.add(b.viewType);
              svg.appendChild(v);
              return v;
            }
            else {
              const v = document.createElementNS(svg.namespaceURI, 'ellipse')!;
              attr(v, { id: b.id, rx: b.radius, ry: b.radius });
              v.classList.add(b.viewType);
              svg.appendChild(v);
              return v;
            }
          }
          const v = document.getElementById(b.id) || createBodyView(b);
          b.viewType === 'Shield_PU'? attr(v, { x: b.pos.x, y: b.pos.y }):attr(v, { cx: b.pos.x, cy: b.pos.y })
        };
        
        
        s.bullets.forEach(updateBodyView);
        s.aliens.forEach(updateBodyView);
        s.shields.forEach(updateBodyView);
        //console.log(s.powerUps)
        s.powerUps.forEach(updateBodyView)
      // remove the expired bullets
      
      s.exit.forEach(o=>{
        const v = document.getElementById(o.id);
        if(v) svg.removeChild(v)
      })

      //Score Display
      const score = document.getElementById('score_board')
      score.textContent = `Score : ${s.score}`

      //Lives Display
      const lives = document.getElementById('health')
      lives.textContent = `Lives : ${s.lives}`

      //Level Display
      const level = document.getElementById('level')
      level.textContent = `Level : ${s.level}`

      // Handles GameOver:
      if(s.gameOver) {
        // check whether game over is already on
        const gameOver_object = document.getElementById('Game Over Display')
        
        if (!gameOver_object){
        // insert the game over text
        svg_text_creator (svg)('Game Over Display')(Constants.CANVAS_SIZE/6)
                          (Constants.CANVAS_SIZE/2)('gameover')('Game Over')
        // inserts the restart instruction
        svg_text_creator (svg)('restart')(Constants.CANVAS_SIZE/4.5)(Constants.CANVAS_SIZE/1.7)
                          ("instruction")("Press F1 to restart the game!")
      }
    }
      // Handles Victory:
      if(s.victory) {
        // check whether game over is already on
        const victory_object = document.getElementById('victory announcement')

        if (!victory_object){
          // insert the vicotry text
          svg_text_creator (svg)('victory announcement')(Constants.CANVAS_SIZE/4.5)
                            (Constants.CANVAS_SIZE/2)("Victory")("VICTORY")
          // inserts the restart instruction
          svg_text_creator (svg)('restart')(Constants.CANVAS_SIZE/4.5)(Constants.CANVAS_SIZE/1.7)
                            ("instruction")("Press F1 to restart the game!")
          // inserts the restart instruction
          svg_text_creator (svg)('levelup')(Constants.CANVAS_SIZE/4.6)(Constants.CANVAS_SIZE/1.55)
                            ("instruction")("Press F2 to level up the game!")
      }
      }
      // Handles Restarts:
      if(s.restart) {
        svg_cleanUp (svg)
      }
      // Handles level:
      if(s.levelUp) {
        svg_cleanUp (svg)
      }
    }


    //---------------------------- SUBSCRIPTION -----------------------------//
    const subscription = interval(10).pipe(
        map(elapsed=>new Tick(elapsed)),
        merge(startLeftMove,startRightMove,stopLeftMove,stopRightMove,shoot,restart,nxtLevel),
        scan(reduceState, initialState))
      .subscribe(updateView)
    }
    window.onload = run_the_game
    
  }
      
  
}

spaceinvaders() 

/////////////////////////////////////////////////////////////////////
// Utility functions

// A simple immutable vector class
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b:Vec) => this.add(b.scale(-1))
  len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
  scale = (s:number) => new Vec(this.x*s,this.y*s)
  ortho = ()=> new Vec(this.y,-this.x)
  rotate = (deg:number) =>
            (rad =>(
                (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
              )(Math.cos(rad), Math.sin(rad), this)
            )(Math.PI * deg / 180)

  static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
  static Zero = new Vec();
}
function flatMap<T, U>(
  a: ReadonlyArray<T>,
  f: (a: T) => ReadonlyArray<U>
): ReadonlyArray<U> {
  return Array.prototype.concat(...a.map(f));
}
const exists =<T>(val:T) => (arr:T[]) => arr.filter(e => val===e ? 1 : 0).length > 0,
except = <T>(eq: (_: T) => (_: T) => boolean) => (a: ReadonlyArray<T>) => (
  b: ReadonlyArray<T>
) => a.filter(not(elem(eq)(b))),
not = <T>(f: (x: T) => boolean) => (x: T) => !f(x),
elem = <T>(eq: (_: T) => (_: T) => boolean) => (a: ReadonlyArray<T>) => (
  e: T
) => a.findIndex(eq(e)) >= 0


