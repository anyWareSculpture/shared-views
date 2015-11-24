/*
  Game event               Sound                      Logic

  Enter alone mode         Alone_Mode/Pulse_amb_loop  FIXME
  Handshake                Alone_Mode/Hand_Shake_01   changes.handshakes (Set of bool)

Mole:
  Panel activated          Game_01/G01_LED_XX
  Active panel touched     Game_01/G01_Success_01
  Non-active panel touched Game_01/G01_Negative_01

Disk:

Simon:
  Panel activated during pattern animation
                           Game_03/G03_LED_XX
  Correct panel touched
                           Game_03/G03_LED_XX
  Wrong panel touched
                           Game_03/G03_Negative_01
  Won level (after short delay)
                           Game_03/G03_Success_01
  Won all levels (after short delay)
                           Game_03/G03_Light_Show_01

*/

const _ = require('lodash');

const SculptureStore = require('@anyware/game-logic/lib/sculpture-store');
const GAMES = require('@anyware/game-logic/lib/constants/games');
import {Sound, VCFSound} from './audio-api';

export default class AudioView {
  constructor(store, config, dispatcher) {
    this.store = store;
    this.config = config;
  }

  reset() {
  }
  
  /**
   * Loads all sounds, calls callback([err]) when done
   */
  load(callback) {
    // Maps logical sound identifiers to filenames. We'll load these sounds next.
    this.sounds = {
      alone: {
        ambient: new VCFSound({url: 'sounds/Alone_Mode/Pulse_Amb_Loop.wav', fadeIn: 3}),
        handshake: 'sounds/Alone_Mode/Hand_Shake_01.wav'
      },
      mole: {
        success: 'sounds/Game_01/G01_Success_01.wav',
        failure: 'sounds/Game_01/G01_Negative_01.wav',
        panels: [0,1,2].map(stripId => _.range(10).map(panelId => `sounds/Game_01/G01_LED_${("0"+(stripId*10+panelId+1)).slice(-2)}.wav`))
      },
      disk: {
        ambient: new Sound({url: 'sounds/Game_02/G02_Amb_Breath_Loop_01.wav', loop: true}),
        loop: new Sound({url: 'sounds/Game_02/G02_Disk_Loop_Ref_01.wav', loop: true, rate: 2, gain: 0.3, fadeIn: 10}),
        distance: new Sound({url: 'sounds/Game_02/G02_Disk_Loop_01.wav', loop: true, rate: 2, gain: 0.5, fadeIn: 10}),
        lighteffect: 'sounds/Game_02/G02_Lights_01.wav',
        success: 'sounds/Game_02/G02_Success_01.wav',
        show: 'sounds/Game_02/G02_Success_final_01.wav'
      },
      simon: {
        panels: [0,1,2].map(stripId => _.range(10).map(panelId => `sounds/Game_03/G03_LED_${("0"+(stripId*10+panelId+1)).slice(-2)}.wav`)),
        success: 'sounds/Game_03/G03_Success_01.wav',
        failure: 'sounds/Game_03/G03_Negative_01.wav',
        show: 'sounds/Game_03/G03_Light_Show_01.wav'
      }
    };

    // Traverse this.sounds and replace the filenames with valid sound objects.
    this._promises = [];
    this._traverse(this.sounds, this._promises);

    // _traverse() will create promises. We call the callback once all promises resolve
    console.log(`${this._promises.length} promises`);
    Promise.all(this._promises)
      // Don't listen to events until we've loaded all sounds
      .then(() => this.store.on(SculptureStore.EVENT_CHANGE, this._handleChanges.bind(this)))
      .then(() => callback(null))
      .catch(callback.bind(null));
  }

  /**
   * Traverses sound config objects and replaces nodes with valid, loaded, sounds
   * populates the given promises array with promises of loaded sounds
   */
  _traverse(node, promises) {
    for (let key in node) {
      const value = node[key];
      let sound;
      if (typeof value === 'string') sound = node[key] = new Sound({url: value});
      else if (value instanceof Sound) sound = value;
      if (sound) promises.push(sound.load());
      else this._traverse(value, promises);
    }
  }

  _handleChanges(changes) {
    // FIXME: Turn changes in sculpture store into audio here
  }
}
