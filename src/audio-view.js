/**
 *  Startup or transition into Handshake game
 *  o Start ambient sound
 *   Handshake interaction:
 *  o play handshake play
 *  o stop ambient sound
 *   Mole Game:
 *  We have 3 sounds
 *  1) Light activated: Panel comes on with 'neutral' color using ACTIVE_PANEL_INTENSITY
 *  2) Success interaction: panel turn active and state == TrackedPanels.STATE_IGNORED
 *  3) Fail interaction: panel turn active and state == TrackedPanels.STATE_OFF
 *  Q: Sound on light deactivated? (similar to 1) but opposite)
 *   Success animation
 *  o Play Success sound (missing)
 *   Transition animation to Disk Game
 *  o For each light on event, play lighteffect sound (4 events)
 *  o FIXME: Some sort of demo/helper to clarify interaction
 *   Disk Game
 *  o Start ambient sound (FIXME: Fading vs. loop, new sound from Alain?)
 *  o Start loop sound (loop)
 *  o Start distance sound (loop)
 *  o Calculate distance from success (positive and negative distance)
 *    -> use distance to modulate pitch of distance sound
 *  Level success animation
 *  o On success of level 1 and 2, play success sound
 *  o On perimeter light on event, play lighteffect sound
 *   Success animation
 *  o On success of level 3, play show sound
 *  o For each light off event, play lighteffect sound (3 events)
 *   Transition animation to Simon Game
 *  o No sounds
 *   Simon Game
 *  o On animation playback, play panel sounds
 *  o On correct local interaction, play panel sounds
 *  o On free play, play panel sounds
 *  o On fail local interaction, play failure sound
 *  o On level success, play success sound
 *   Light show and transition back to Start State
 *  o play show sound
 */

const _ = require('lodash');

const SculptureStore = require('@anyware/game-logic/lib/sculpture-store');
const GAMES = require('@anyware/game-logic/lib/constants/games');
const {TrackedPanels} = require('@anyware/game-logic/lib/utils/panel-group');
const Disk = require('@anyware/game-logic/lib/utils/disk');
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
    let lfoFreq = 1/3;
    if (this.config.hasOwnProperty('HANDSHAKE_HARDWARE') &&
        this.config.HANDSHAKE_HARDWARE.hasOwnProperty('PULSE_DELAY')) {
      lfoFreq = 1000/this.config.HANDSHAKE_HARDWARE.PULSE_DELAY;
    }

    // Maps logical sound identifiers to filenames. We'll load these sounds next.
    this.sounds = {
      alone: {
        ambient: new VCFSound({url: 'sounds/Alone_Mode/Pulse_Amb_Loop.wav', lfoFreq, fadeIn: 3, gain: 0.4}),
        handshake: new Sound({url: 'sounds/Alone_Mode/Hand_Shake_01.wav'})
      },
      mole: {
        success: new Sound({url: 'sounds/Game_01/G01_Success_01.wav', gain: 0.5}),
        failure: new Sound({url: 'sounds/Game_01/G01_Negative_01.wav', gain: 0.5}),
        panels: [0,1,2].map(stripId => _.range(10).map(panelId => new Sound({url: `sounds/Game_01/G01_LED_${("0"+(stripId*10+panelId+1)).slice(-2)}.wav`, gain: 0.33})))
      },
      disk: {
        ambient: new Sound({url: 'sounds/Game_02/G02_Amb_Breath_Loop_01.wav', loop: true}),
        disk2: new Sound({url: 'sounds/Game_02/G02_Disk_Loop_C2.wav', loop: true, rate: 1, loopFreq: 2, gain: 0.5, fadeIn: 2}),
        disk1: new Sound({url: 'sounds/Game_02/G02_Disk_Loop_Eb2.wav', loop: true, rate: 1, loopFreq: 1, gain: 0.5, fadeIn: 2}),
        disk0: new Sound({url: 'sounds/Game_02/G02_Disk_Loop_G2.wav', loop: true, rate: 1, loopFreq: 1, gain: 0.5, fadeIn: 2}),
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
    if (this.store.isPlayingHandshakeGame) this._handleHandshakeGame(changes);
    if (this.store.isPlayingMoleGame) this._handleMoleGame(changes);
    if (this.store.isPlayingDiskGame) this._handleDiskGame(changes);
    if (this.store.isPlayingSimonGame) this._handleSimonGame(changes);
  }

  _handleHandshakeGame(changes) {
    // On startup, or when Start State becomes active, play ambient sound
    if (changes.currentGame === GAMES.HANDSHAKE) this.sounds.alone.ambient.play();

    if (changes.handshakes) {
      // Did someone shake my hand?
      if (changes.handshakes[this.config.username]) {
        this.sounds.alone.ambient.stop();
        this.sounds.alone.handshake.play();
      }
      // FIXME: Did someone else shake hands? -> dimmed sound?
    }
  }

  _handleMoleGame(changes) {
    const lightChanges = changes.lights;
    if (!lightChanges || !this.store.isReady) return;

    /*
      Mole game sounds:
      o If a panel got activated (changes.lights.<stripId>.panels.<panelId>.active === true)
      changes.mole.panels.<id> == STATE_IGNORED: Just turned -> success?
      state.mole.panels.<id> == STATE_OFF: failure
    */
    // If a panel got activated (changes.lights.<stripId>.panels.<panelId>.active === true)
    for (let stripId in lightChanges) for (let panelId in lightChanges[stripId].panels) {
      const panelChange = lightChanges[stripId].panels[panelId];
      if (panelChange.active === true) {
        const panelkey = `${stripId},${panelId}`;
        if (changes.mole && changes.mole.panels) {
          const state = changes.mole.panels[panelkey];
          if (state == TrackedPanels.STATE_IGNORED) { // Panel was turned -> success
            this.sounds.mole.success.play();
          }
        }
        else {
          const state = this.store.data.get('mole').get('panels').get(panelkey);
          if (!state || state === TrackedPanels.STATE_OFF) {
            this.sounds.mole.failure.play();
          }
        }
      }
      else if (panelChange.intensity > 90) {
        this.sounds.mole.panels[stripId][panelId].play();
      }
    }
  }

  _handleDiskGame(changes) {
    if (changes.status === SculptureStore.STATUS_SUCCESS) {
      // End of game
      if (this.store.data.get('disk').get('level') >= this.config.DISK_GAME.LEVELS.length) {
        this.sounds.disk.disk0.stop();
        this.sounds.disk.disk1.stop();
        this.sounds.disk.disk2.stop();
        this.sounds.disk.show.play();
      }
      // End of level
      else {
        this.sounds.disk.success.play();
      }
    }

    // On start of disk game
    // FIXME: Is transition part of the disk game?
    if (changes.currentGame === GAMES.DISK) {
      // Start all sounds in silent mode
      this.sounds.disk.disk0.play({gain: 0});
      this.sounds.disk.disk1.play({gain: 0});
      this.sounds.disk.disk2.play({gain: 0});
    }
    
    // On start of level
    if (changes.hasOwnProperty('disk') &&
        changes.disk.hasOwnProperty('level') &&
        changes.disk.level < this.config.DISK_GAME.LEVELS.length) {
    }
    
    if (changes.disks) {
      const disks = this.store.data.get('disks');

      for (let disk of ['disk0', 'disk1', 'disk2']) {
        if (changes.disks.hasOwnProperty(disk) && 
            changes.disks[disk].hasOwnProperty('direction') &&
            disks.get(disk).get('state') === Disk.STATE_READY) {
          if (changes.disks[disk].direction === Disk.STOPPED) this.sounds.disk[disk].fadeOut({delay: 3});
          else this.sounds.disk[disk].fadeIn();
        }
      }

      const diskgame = this.store.currentGameLogic;
      const score = diskgame.getScore(disks);
      //console.log(`score: ${score}`);
      // score = 0 -> 540
      const factor = score / 540 * 3 + 1;
      const rate = 1/factor;
      const pulseFreq = this._calcFreq(score);
      // FIXME: Set our loopFreq property instead and deal with audio node stuff internally
      //console.log(`pulseFreq: ${pulseFreq}`);
      if (this.sounds.disk.disk0.source) this.sounds.disk.disk0.source.loopEnd = (pulseFreq === 0 ? 0 : 1/pulseFreq);
      if (this.sounds.disk.disk1.source) this.sounds.disk.disk1.source.loopEnd = (pulseFreq === 0 ? 0 : 1/pulseFreq);
      if (this.sounds.disk.disk2.source) this.sounds.disk.disk2.source.loopEnd = (pulseFreq === 0 ? 0 : 1/pulseFreq);
    }
    // FIXME level success and final success
  }

  _calcFreq(score) {
    function map(value, in_min, in_max, out_min, out_max) {
      return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }
    if (score > 200) {
      return map(score, 540, 200, 0.5, 1);
    }
    else if (score > 100) {
      return map(score, 200, 100, 1, 4);
    }
    else if (score > 50) {
      return map(score, 100, 50, 4, 10);
    }
    else {
      return map(score, 50, 0, 10, 60);
    }
  }

  _handleSimonGame(changes) {
    if (changes.status === SculptureStore.STATUS_SUCCESS) this.sounds.simon.success.play();
    if (changes.status === SculptureStore.STATUS_FAILURE) this.sounds.simon.failure.play();

    const lightChanges = changes.lights;
    if (!lightChanges || !this.store.isReady) return;

    for (let stripId in lightChanges) for (let panelId in lightChanges[stripId].panels) {
      const panelChange = lightChanges[stripId].panels[panelId];
      if (panelChange.active || panelChange.intensity > 90) {
        this.sounds.simon.panels[stripId][panelId].play();
      }
    }
  }
}
