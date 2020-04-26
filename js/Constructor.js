// PhyzzyConstructor.js
"use strict";

// Initialize canvas element.
const viewport = document.getElementById("viewport");
const ctx = viewport.getContext("2d");

// Initialize buttons.
const pauseButton = document.getElementById("userPause");
const constructButton = document.getElementById("userConstruct");
const deleteButton = document.getElementById("userDelete");
const clearButton = document.getElementById("userClear");

// User mode control.
const mode = {
    pause: false,
    construct: false,
    udelete: false
};
const setPause = p => {
    mode.pause = p;
    if (mode.pause)
    {
        pauseButton.value = "play";
    } else {
        pauseButton.value = "pause";
        setConstruct(false);
    }
}
const setConstruct = c => {
    mode.construct = c;
    if (mode.construct)
    {
        constructButton.value = "move/select";
        setPause(true);
        setDelete(false);
    } else {
        constructButton.value = "construct";
    }
}
const setDelete = d => {
    mode.udelete = d;
    if (mode.udelete)
    {
        deleteButton.value = "select";
        setConstruct(false);
    } else {
        deleteButton.value = "delete";
    }
}
// Button event listeners.
pauseButton.addEventListener('click', () => {
    setPause(!mode.pause);

}, false);
constructButton.addEventListener('click', () => setConstruct(!mode.construct), false);
deleteButton.addEventListener('click', () => setDelete(!mode.udelete), false);

// Initialize model.
let delta = 1 / 60; // step time
const phz = new PhyzzyModel(100);

// Initialize environment.
const env = new PhyzzyEnvironment(
    {x: 0, y: 9.81},
    1,
    {x: 0, y: 0, w: viewport.width / phz.scale, h: viewport.height / phz.scale}
    );
    
const mProp = {mass: 0.1, rad: 0.05, refl: 0.7, mu_s: 0.4, mu_k: 0.2};
Builders.generateBox(2, 2, 1, 1, mProp, 100, 50, phz);
phz.mesh[1].fix = true;

// Indicate state of user's interaction with model.
const user = {
    mpos: new Vect(),       // Cursor position.
    tpos: new Vect(),       // Touch position.
    highlight: undefined,   // Highlighted mass.
    select: undefined,      // Selected mass.
    drag: undefined,        // Mass being dragged.
    springFrom: undefined,  // Connect next mass with spring.
    draw: function(model) {
        if (this.highlight) {
            if (!mode.udelete) ctx.strokeStyle = "#62B564";
            else ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.arc(
                this.highlight.Pi.x * model.scale,
                this.highlight.Pi.y * model.scale,
                this.highlight.rad * model.scale + 5,
                0, 2 * Math.PI);
                ctx.closePath();
            ctx.stroke();
        }
        if (this.springFrom)
        {
            ctx.strokeStyle = "#62B564";
            ctx.beginPath();
            ctx.moveTo(this.springFrom.Pi.x * model.scale, this.springFrom.Pi.y * model.scale);
            if (!this.highlight) ctx.lineTo(this.mpos.x, this.mpos.y);
            else ctx.lineTo(this.highlight.Pi.x * model.scale, this.highlight.Pi.y * model.scale);
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(
                this.springFrom.Pi.x * model.scale,
                this.springFrom.Pi.y * model.scale,
                this.springFrom.rad * model.scale + 10,
                0, 2 * Math.PI);
            ctx.closePath();
            ctx.stroke();
        }
        if (this.select) {
            ctx.strokeStyle = "black";
            ctx.beginPath();
            ctx.arc(
                this.select.Pi.x * model.scale,
                this.select.Pi.y * model.scale,
                this.select.rad * model.scale + 5,
                0, 2 * Math.PI);
            ctx.closePath();
            ctx.stroke();
        }
    },
    reset: function() {
        this.highlight = undefined;
        this.select = undefined;
        this.drag = undefined;
    }
};

const debugData = prvTime => {
    let curTime = performance.now();
    let t_diff = curTime - prvTime;
    ctx.fillStyle = "black";
    ctx.fillText((1000 / t_diff).toFixed(3) + " fps", 10, 10);
    ctx.fillText("Cursor: " + phz.scaleV(user.mpos).display(3), 10, 20);
    ctx.fillText("Touch:" + phz.scaleV(user.tpos).display(3), 10, 30);
    ctx.fillText("Highlight: " + user.highlight, 10, 40);
    ctx.fillText("Select: " + user.select, 10, 50);
    ctx.fillText("Drag: " + user.drag, 10, 60);
    ctx.fillText("SpringFrom: " + user.springFrom, 10, 70);
    return curTime;
}
// Main animation frame function.
let prv = performance.now();
const frame = () => {
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    phz.drawSpring(ctx, '#000000');
    phz.drawMass(ctx, '#1DB322');
    user.highlight = phz.locateMass(phz.scaleV(user.mpos), 0.2);
    user.draw(phz);

    if (!mode.pause){
        phz.update(phz.mesh.map(mass => {
            let f = env.weight(mass).sum(env.drag(mass))
            .sum(mass.springing()).sum(mass.damping())
            f = f.sum(env.friction(mass, f));
            return f;
        }), delta);
        phz.collision(phz.mesh.map(mass => env.boundaryHit(mass)))
    }

    prv = debugData(prv);
    window.requestAnimationFrame(frame);
}

// Constructor helper functions.
const defaultMassProp = {mass: 0.1, rad: 0.05, refl: 0.7, mu_s: 0.4, mu_k: 0.2};
const defaultSpringProp = {stiff: 100, damp: 50};
const constructorCase1 = () => {
    // User clicks empty space with no spring generating.
    if (!user.highlight && !user.springFrom) {
        const m = new Mass(defaultMassProp, phz.scaleV(user.mpos));
        phz.addM(m);
        user.select = m;
        user.springFrom = user.select;
    }
}
const constructorCase2 = () => {
    // User clicks empty space with previously selected mass and spring generating
    if (!user.highlight && user.springFrom) {
        const m = new Mass(defaultMassProp, phz.scaleV(user.mpos));
        const len = user.springFrom.Pi.segLen(m.Pi);
        const s = new Spring(len, defaultSpringProp.stiff, defaultSpringProp.damp);
        phz.addM(m);
        phz.addS(user.springFrom, m, s);
        user.select = m;
        user.springFrom = user.select;
    }
}
const constructorCase3 = () => {
    // User clicks on existing mass with spring generating enabled.
    if (user.highlight && user.springFrom)
    {
        user.springFrom = undefined;
    }
}
const constructorCase4 = () => {
    // User clicks on existing mass with spring generating disabled.
    if (user.highlight && !user.springFrom) {
        user.springFrom = user.select;
    }
}
const constructorCase5 = () => {
    // User clicks existing mass with spring generating enabled.
    if (user.highlight && user.springFrom)
    {
        const len = user.springFrom.Pi.segLen(user.highlight.Pi);
        const s = new Spring(len, defaultSpringProp.stiff, defaultSpringProp.damp);
        phz.addS(user.springFrom, user.highlight, s);
        user.select = user.highlight;
        user.springFrom = user.select;
    }
}

// Mouse event handlers.
const mouseMoveHandler = e => {
    user.mpos.set(e.clientX - viewport.offsetLeft, e.clientY - viewport.offsetTop);
    if (user.drag)
    {
        const mMov = new Vect(e.movementX, e.movementY);
        user.drag.Po.equ(user.drag.Pi);
        user.drag.Pi.sumTo(phz.scaleV(mMov));
    }
}
const mouseDownHandler = e => {
    user.select = user.highlight;
    user.drag = user.select;
    if (user.drag) user.drag.ignore = true;
    if (mode.construct)
    {
        if (!user.highlight && !user.springFrom) constructorCase1();
        else if (!user.highlight && user.springFrom) constructorCase2();
        else if (user.highlight && !user.springFrom) constructorCase4();
        else if (user.highlight && user.springFrom) constructorCase5();
    }
    if (mode.udelete)
    {
        phz.remM(user.select);
        user.reset();
    }
}
const mouseUpHandler = e => {
    if (user.drag) 
    {
        user.drag.ignore = false;
        user.drag = undefined;
    }
}
const doubleClickHandler = e => {
    if (mode.construct)
    {
        constructorCase3();
    }
}
// Touch event handlers.
const tPos_capture = e => {
    const pos = new Vect(
        e.touches[0].clientX - viewport.offsetLeft,
        e.touches[0].clientY - viewport.offsetTop);
    return pos;
}
const tPos_prv = new Vect();
const touchStartHandler = e => {
    user.tpos.equ(tPos_capture(e));
    user.select = phz.locateMass(phz.scaleV(user.tpos), 0.3);
    user.drag = user.select;
    if (user.drag) user.drag.ignore = true;
}
const touchMoveHandler = e => {
    tPos_prv.equ(user.tpos);
    user.tpos.equ(tPos_capture(e))
    const tmov = new Vect();
    tmov.equ(user.tpos.sub(tPos_prv));
    if (user.drag) {
        user.drag.Po.equ(user.drag.Pi);
        user.drag.Pi.sumTo(phz.scaleV(tmov));
    }
}
const touchEndHandler = e => {
    user.tpos.clr();
    if (user.drag) user.drag.ignore = false;
    user.drag = undefined;
}

// Mousing events.
viewport.addEventListener("mousemove", mouseMoveHandler, false);
viewport.addEventListener("mousedown", mouseDownHandler, false);
viewport.addEventListener("mouseup", mouseUpHandler, false);
viewport.addEventListener("dblclick", doubleClickHandler, false);
// Touch events.
viewport.addEventListener("touchstart", touchStartHandler, false);
viewport.addEventListener("touchmove", touchMoveHandler, false);
viewport.addEventListener("touchend", touchEndHandler, false);

// Clear model on clicking the clear button.
clearButton.addEventListener('click', () => phz.clear(), false);

// Initilize modes.
setPause(false);
setConstruct(false);
setDelete(false);

// Run constructor animation.
frame();