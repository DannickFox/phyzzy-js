// spring.js
// Spring library
// Links two masses together for springing.
// Spring must be referenced upon creation.
'use strict'
const Springer = state => ({
    springing: (Pi1, Pi2) => {
        // calculate springing force from segment of mass1 to mass2
        const seg12 = Pi1.sub(Pi2)
        return seg12.unit().mul(state.stiffness * (state.restlength - seg12.mag()))
    }
})
const Damper = state => ({
    damping: (Pi1, Po1, Pi2, Po2) => {
        const seg12 = Pi1.sub(Pi2)
        const diff12 = seg12.sub(Po1.sub(Po2))
        return diff12.pjt(seg12).mul(-state.resistence)
    }
})

const Spring = (restlength, stiffness, resistence) => {
    let state = {
        restlength,
        stiffness,
        resistence
    }
    return Object.assign(
        state,
        Springer(state),
        Damper(state)
    )
}

module.exports = Spring