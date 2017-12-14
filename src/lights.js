/*
 * lights
 */

const convert = require('color-convert');
const request = require('request-promise-native');
const forEach = require('lodash/forEach');

let state = {
  luminaires: [],
  changesToDispatch: [],
  willDispatch: false,
};
let server;

const dispatchChanges = () => {
  state.willDispatch = false;
  console.log('dispatching changes:', JSON.stringify(state.changesToDispatch));

  // TODO: merge / get rid of potential duplicates?
  state.changesToDispatch.forEach(luminaire =>
    server.events.emit('luminaireUpdate', luminaire),
  );

  state.changesToDispatch = [];
};

class Light {
  constructor(parentLuminaire, initialState = { rgb: [255, 255, 255] }) {
    this.parentLuminaire = parentLuminaire;

    this.state = this.convertAll(initialState);
    this.prevState = this.convertAll(initialState);

    this.transitionStart = new Date().getTime();
    this.transitionEnd = new Date().getTime();
  }

  toJSON() {
    return {
      state: this.state,
      transitionTime: this.transitionEnd - this.transitionStart,
    };
  }

  convertAll(lightState) {
    const colorModes = {};

    Object.entries(lightState).forEach(([colorMode, values]) => {
      colorModes[colorMode] = values;

      const shouldConvert = ['rgb', 'xyY', 'ct', 'hsv'].filter(
        mode => mode !== colorMode,
      );

      shouldConvert.forEach(
        mode => (colorModes[mode] = convert[colorMode][mode].raw(values)),
      );
    });

    return colorModes;
  }

  setState(nextState) {
    // TODO: handle ongoing transition
    this.prevState = this.state;

    this.state = this.convertAll(nextState);

    this.transitionStart = new Date().getTime();
    this.transitionEnd =
      new Date().getTime() + (nextState.transitionTime || 500);

    // TODO: some form of diffing here?
    state.changesToDispatch.push(this.parentLuminaire);

    if (!state.willDispatch) {
      state.willDispatch = true;
      process.nextTick(dispatchChanges);
    }
  }
}

class Luminaire {
  constructor({
    id = 'N/A',
    gateway = 'unknown',
    name = 'Unnamed Light',
    numLights = 1,
    initialStates = [],
  }) {
    this.id = id;
    this.gateway = gateway;
    this.name = name;
    this.lights = [...Array(numLights)].map(
      (_, index) => new Light(this, initialStates[index]),
    );
  }
}

const registerLuminaire = fields => {
  if (state.luminaires.find(luminaire => luminaire.id === fields.id)) {
    return console.log('Error: registerLuminaire() with already existing id!');
  }

  console.log('registerLuminaire():', JSON.stringify(fields));

  state.luminaires.push(new Luminaire(fields));
};

const setLight = (luminaireId, lightId, fields) => {
  const luminaire = state.luminaires.find(
    luminaire => luminaire.id === luminaireId,
  );
  if (!luminaire) {
    return console.log('Error: setLight() called with unknown luminaire id!');
  }

  const light = luminaire.lights[lightId];
  if (!light) {
    return console.log('Error: setLight() called with unknown light id!');
  }

  console.log('setLight():', JSON.stringify(fields));
  light.setState(fields);

  /*
  //const light = lights[lightId];

  //console.log('lights: sending lightstate updates to', lightId, needsUpdate);

  lights.forEach(light => {
    lightsCache[light.id] = {
      ...lightsCache[light.id],
      ...light,
    };
  });

  if (!state.willDispatch) {
    state.willDispatch = true;
    process.nextTick(dispatchChanges);
  }
  */
};

const getLuminaires = () => state.luminaires;

const getLuminaire = luminaireId =>
  state.luminaire.find(luminaire => luminaire.id === luminaireId);

const getLight = (luminaireId, lightId) => {
  const luminaire = getLuminaire(luminaireId);

  if (!luminaire) return;

  return luminaire.lights[lightId];
};

const register = async function(_server, options) {
  server = _server;
  /*
  if (!server.config.hue.username) {
    throw 'lights: USERNAME env var not supplied, aborting...';
  }
  */

  server.events.on('start', async () => {
    // TODO: light discovery (plugins should do this, and we should support updates)
    /*
    // Discover existing lights
    lights = await server.emitAwait('getLights');
    */
    //server.events.on('setLights', setLights);
    //server.events.on('getLights', getLights);
    // server.events.on('lightChanged', lightChanged);
  });

  server.event({ name: 'luminaireUpdate', clone: true });
  server.event({ name: 'registerLuminaires', clone: true });
  server.event({ name: 'removeLights', clone: true });
  server.event({ name: 'setLights', clone: true });
  // server.event({ name: 'lightChanged', clone: true });
};

module.exports = {
  name: 'lights',
  version: '1.0.0',
  register,
  getLuminaires,
  getLuminaire,
  getLight,
  setLight,
  registerLuminaire,
};
