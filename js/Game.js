// Game.js (エントリーポイント、この上にmain.jsとindex.htmlが居る)
import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // CameraManager内でimport

import { PhysicsManager } from './PhysicsManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Character } from './Character.js';
import { InputManager } from './InputManager.js';
import { CameraManager } from './CameraManager.js';
import { ProjectileManager } from './ProjectileManager.js';
import { SphereManager } from './SphereManager.js';
import { RamielManager } from './RamielManager.js';
import { Minimap } from './Minimap.js';
import { EffectManager } from './EffectManager.js';
import { EnemyManager } from './EnemyManager.js';
// import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // EnemyManager内でimport/使用

import { // 定数をインポート
    GRAVITY, MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS,
    CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE, CHARACTER_LOCAL_FORWARD,
    CHARACTER_SPEED, CHARACTER_ROTATION_SPEED, CHARACTER_HEIGHT,
    KICK_BEAM_DELAY, BEAM_SPAWN_OFFSET_FORWARD,
    NUM_SPHERES, MAZE_SCALE, MINIMAP_ENABLED, // NUM_SPHERES は初期数に使用
    MINIMAP_INDICATOR_Y_OFFSET,
    NUM_RAMIELS, RAMIEL_COLOR,RAMIEL_SIZE, // NUM_RAMIELS は初期数に使用
    BEAM_DAMAGE,
    MAKANKO_BEAM_TYPE_ENABLED,
    // オーディオ関連の定数
    BGM_PATH, BGM_VOLUME, BGM_LOOP,
    SFX_BEAM_PATH, SFX_BEAM_VOLUME, SFX_BEAM_LOOP,
    // 太陽の定数
    SUN_ENABLED, SUN_POSITION, SUN_SIZE, SUN_COLOR,SUN_EMISSIVE_INTENSITY,
    DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY,
    DIRECTIONAL_LIGHT_CAST_SHADOW,
    DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH, DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT,
    DIRECTIONAL_LIGHT_SHADOW_BIAS,
    SHADOW_CAMERA_NEAR, SHADOW_CAMERA_FAR, SHADOW_CAMERA_SIZE,
    RAMIEL_AT_FIELD_RADIUS,
    RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL,
    RAMIEL_AT_FIELD_ENABLED,
    // Enemy_001関連の定数をインポート (AssetLoaderが使用するパスとスケール)
    ENEMY_001_MODEL_PATH, ENEMY_001_ANIMATIONS, ENEMY_001_SCALE,
    ENEMY_001_SPAWN_SETTINGS, // Enemy_001の初期数を取得するため
    SPHERE_SCORE, RAMIEL_SCORE, ENEMY_001_SCORE,

    // Enemy_002 関連の定数をインポート
    ENEMY_002_MODEL_PATH, ENEMY_002_ANIMATIONS, ENEMY_002_SCALE,
    ENEMY_002_SPAWN_SETTINGS, ENEMY_002_SCORE, // 必要に応じて他の ENEMY_002 定数も

    // キャラクターパワーアップスコア定数をインポート
    CHARACTER_POWERUP_LEVEL_1_SCORE,
    CHARACTER_POWERUP_LEVEL_2_SCORE,
    CHARACTER_POWERUP_LEVEL_3_SCORE,
    CHARACTER_POWERUP_LEVEL_4_SCORE,

    // 敵汎用ATフィールド関連の定数をインポート
    ENEMY_GENERIC_AT_FIELD_ENABLED, ENEMY_GENERIC_AT_FIELD_COLOR,
    ENEMY_GENERIC_AT_FIELD_RADIUS_FACTOR, ENEMY_GENERIC_AT_FIELD_OFFSET_Y_FACTOR,
    ENEMY_GENERIC_AT_FIELD_NUM_RINGS, ENEMY_GENERIC_AT_FIELD_RING_DURATION,
    ENEMY_GENERIC_AT_FIELD_SPAWN_INTERVAL, ENEMY_GENERIC_AT_FIELD_START_SCALE,
    ENEMY_GENERIC_AT_FIELD_END_SCALE_FACTOR, ENEMY_GENERIC_AT_FIELD_RING_THICKNESS_RATIO,
    ENEMY_GENERIC_AT_FIELD_FADE_OUT_START_RATIO_PER_RING, ENEMY_GENERIC_AT_FIELD_INITIAL_OPACITY,
    ENEMY_GENERIC_AT_FIELD_OFFSET_HORIZONTAL_FACTOR,

} from './constants.js';


class Game {
    constructor() {
        // --- Three.js 関連 ---
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this._setupRenderer();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000 * MAZE_SCALE);

        // --- ゲームの状態やワールドに関するもの ---
        this.world = { mazeModel: null, collidables: [], mazeFloor: null };
        this.raycastTargets = [];
        this.mazeFloorMaxY = 0;
        this.gameStarted = false;
        this.tempTransform = null;

        // --- DOM要素の取得 ---
        this.startGameMessageElement = document.getElementById('start-game-message');
        this.loadingMessageElement = document.getElementById('loading-message');
        this.bgmVolumeSlider = document.getElementById('bgm-volume-slider');
        this.bgmVolumeValueSpan = document.getElementById('bgm-volume-value');
        this.sfxVolumeSlider = document.getElementById('sfx-volume-slider');
        this.sfxVolumeValueSpan = document.getElementById('sfx-volume-value');

        // --- UI要素の取得 (スコアと残り数表示用) ---
        this.scoreValueElement = document.getElementById('score-value');
        this.powerUpLevelValueElement = document.getElementById('powerup-level-value');
        this.spheresRemainingElement = document.getElementById('spheres-remaining');
        this.ramielsRemainingElement = document.getElementById('ramiels-remaining');
        this.enemies001RemainingElement = document.getElementById('enemies-001-remaining');
        this.enemies002RemainingElement = document.getElementById('enemies-002-remaining');
        // (他の敵タイプの残り数要素も将来追加する場合はここに追加)

        // --- ゲーム内ステータス ---
        this.totalScore = 0;
        this.initialSpheres = 0; // 初期数を保持
        this.initialRamiels = 0;
        this.initialEnemies001 = 0;

        this.initialEnemies002 = 0;

        this.spheresRemaining = 0;
        this.ramielsRemaining = 0;
        this.enemies001Remaining = 0;

        this.enemies002Remaining = 0;
        // (他の敵タイプの残り数も将来追加する場合はここに追加)

        // キャラクターパワーアップ関連のプロパティ
        this.characterPowerUpLevel = 0; // 初期パワーアップレベル
        this.nextPowerUpScore = CHARACTER_POWERUP_LEVEL_1_SCORE; // 最初のパワーアップ目標スコア


        // --- 各マネージャーのインスタンス化 ---
        this.inputManager = new InputManager(this.renderer.domElement);
        this.physicsManager = new PhysicsManager(GRAVITY);
        this.assetLoader = new AssetLoader();
        this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.world.collidables);
        this.effectManager = new EffectManager(this.scene);
        this.projectileManager = new ProjectileManager(this.scene, () => this.raycastTargets, this.effectManager);
        this.sphereManager = new SphereManager(this.scene, this.physicsManager, this.raycastTargets);
        this.ramielManager = new RamielManager(this.scene, this.physicsManager, this.raycastTargets);
        this.enemyManager = null;

        this.character = null;
        this.minimap = MINIMAP_ENABLED ? new Minimap(this.scene, this.renderer) : null;

        // --- オーディオ関連のプロパティ ---
        this.audioListener = new THREE.AudioListener();
        this.audioLoader = new THREE.AudioLoader();
        this.bgmSound = null;
        this.bgmLoaded = false;
        this.bgmPlayInitiated = false;
        this.sfxBeamSound = null;
        this.sfxBeamLoaded = false;

        // console.log("Game constructor finished.");
    }

    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
    }

    async init() {
        try {
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();

            this.enemyManager = new EnemyManager(
                this.scene, this.physicsManager, this.effectManager,
                this.assetLoader, this.raycastTargets, () => this.character
            );

            // --- 初期数の設定とUIの初期更新 ---
            this.initialSpheres = NUM_SPHERES;
            this.spheresRemaining = NUM_SPHERES;
            this.initialRamiels = NUM_RAMIELS;
            this.ramielsRemaining = NUM_RAMIELS;

            if (ENEMY_001_SPAWN_SETTINGS.METHOD === 'FIXED') {
                this.initialEnemies001 = Math.min(ENEMY_001_SPAWN_SETTINGS.NUM_INSTANCES, ENEMY_001_SPAWN_SETTINGS.INITIAL_POSITIONS.length);
            } else { // 他のスポーン方法の場合は、対応する設定から初期数を決定
                this.initialEnemies001 = 0; // ここではFIXEDのみ考慮
            }
            this.enemies001Remaining = this.initialEnemies001;

            // Enemy_002 の初期数を設定
            if (ENEMY_002_SPAWN_SETTINGS.METHOD === 'FIXED') {
                this.initialEnemies002 = Math.min(ENEMY_002_SPAWN_SETTINGS.NUM_INSTANCES, ENEMY_002_SPAWN_SETTINGS.INITIAL_POSITIONS.length);
            } else {
                this.initialEnemies002 = 0;
            }
            this.enemies002Remaining = this.initialEnemies002;



            this.updateGameStatusUI(); // UIを初期状態に更新

            // --- ボリュームスライダー等のUI設定 ---
            if (this.bgmVolumeSlider) {
                this.bgmVolumeSlider.value = BGM_VOLUME.toString();
                if (this.bgmVolumeValueSpan) this.bgmVolumeValueSpan.textContent = `${Math.round(BGM_VOLUME * 100)}%`;
                this.bgmVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.bgmSound) this.bgmSound.setVolume(newVolume);
                    if (this.bgmVolumeValueSpan) this.bgmVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                });
            }
            if (this.sfxVolumeSlider) {
                this.sfxVolumeSlider.value = SFX_BEAM_VOLUME.toString();
                if (this.sfxVolumeValueSpan) this.sfxVolumeValueSpan.textContent = `${Math.round(SFX_BEAM_VOLUME * 100)}%`;
                this.sfxVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.sfxBeamSound) this.sfxBeamSound.setVolume(newVolume);
                    if (this.sfxVolumeValueSpan) this.sfxVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                });
            }

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '3Dシーン環境を初期化中...';
            this._initThreeJSEnvironment();

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'アセットを読み込み中...';
            await this._loadAssetsAndSetupGame();

            // --- オーディオのセットアップ ---
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.cameraManager.getMainCamera().add(this.audioListener);
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(BGM_PATH, (buffer) => {
                    this.bgmSound = new THREE.Audio(this.audioListener);
                    this.bgmSound.setBuffer(buffer);
                    this.bgmSound.setLoop(BGM_LOOP);
                    this.bgmSound.setVolume(this.bgmVolumeSlider ? parseFloat(this.bgmVolumeSlider.value) : BGM_VOLUME);
                    this.bgmLoaded = true;
                    this._checkAllAudioLoadedAndProceed();
                }, (xhr) => {
                    if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                        this.loadingMessageElement.textContent = `BGMを読み込み中... ${Math.round(xhr.loaded / xhr.total * 100)}%`;
                    }
                }, (error) => {
                    console.error('BGMの読み込みに失敗しました:', error);
                    this.bgmLoaded = true; this._checkAllAudioLoadedAndProceed();
                });

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(SFX_BEAM_PATH, (buffer) => {
                    this.sfxBeamSound = new THREE.Audio(this.audioListener);
                    this.sfxBeamSound.setBuffer(buffer);
                    this.sfxBeamSound.setLoop(SFX_BEAM_LOOP);
                    this.sfxBeamSound.setVolume(this.sfxVolumeSlider ? parseFloat(this.sfxVolumeSlider.value) : SFX_BEAM_VOLUME);
                    this.sfxBeamLoaded = true;
                    this._checkAllAudioLoadedAndProceed();
                }, undefined, (error) => {
                    console.error('SFX (beam) の読み込みに失敗しました:', error);
                    this.sfxBeamLoaded = true; this._checkAllAudioLoadedAndProceed();
                });
            } else {
                console.error("Main camera not available, cannot add AudioListener or load audio.");
                this.bgmLoaded = true; this.sfxBeamLoaded = true;
                this._checkAllAudioLoadedAndProceed();
            }

        } catch (error) {
            console.error("ゲームの初期化中に致命的なエラーが発生 (Game.init):", error);
            if (this.loadingMessageElement) {
                this.loadingMessageElement.textContent = 'エラー: 初期化に失敗しました。コンソールを確認。';
                this.loadingMessageElement.style.display = 'block';
                if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'none';
            }
        }
    }

    _checkAllAudioLoadedAndProceed() {
        if (this.bgmLoaded && this.sfxBeamLoaded) {
            if (this.loadingMessageElement) this.loadingMessageElement.style.display = 'none';
            if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'block';
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
            window.addEventListener('resize', this._onWindowResize.bind(this));
            this.animate();
        }
    }

    _handleStartKey(event) {
        if (event.key === 'Enter') {
            if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'none';
            this.gameStarted = true;
            if (!this.bgmPlayInitiated) {
                this._tryPlayBGM();
                this.bgmPlayInitiated = true;
            }
        } else {
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
        }
    }

    _tryPlayBGM() {
        if (!this.bgmLoaded || !this.bgmSound || this.bgmSound.isPlaying) return;
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume().then(() => {
                if(this.bgmSound && !this.bgmSound.isPlaying) this.bgmSound.play();
            }).catch(e => console.error("Error resuming AudioContext for BGM:", e));
        } else {
            if(this.bgmSound && !this.bgmSound.isPlaying) this.bgmSound.play();
        }
    }

    _initThreeJSEnvironment() {
        this.scene.background = new THREE.Color(0x6699cc);
        this.scene.fog = new THREE.Fog(0x6699cc, 800 * MAZE_SCALE, 2500 * MAZE_SCALE);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.8);
        hemiLight.position.set(0, 250 * MAZE_SCALE, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
        dirLight.position.copy(SUN_POSITION);
        dirLight.castShadow = DIRECTIONAL_LIGHT_CAST_SHADOW;
        dirLight.shadow.camera.top = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.left = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.right = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
        dirLight.shadow.camera.far = SHADOW_CAMERA_FAR;
        dirLight.shadow.mapSize.width = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH;
        dirLight.shadow.mapSize.height = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT;
        dirLight.shadow.bias = DIRECTIONAL_LIGHT_SHADOW_BIAS;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
        if (SUN_ENABLED) {
            const sunGeometry = new THREE.SphereGeometry(SUN_SIZE, 32, 32);
            const sunMaterial = new THREE.MeshStandardMaterial({
                emissive: SUN_COLOR, emissiveIntensity: SUN_EMISSIVE_INTENSITY,
                color: SUN_COLOR, metalness: 0.0, roughness: 1.0, fog: false
            });
            const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
            sunMesh.position.copy(SUN_POSITION);
            sunMesh.castShadow = false; sunMesh.receiveShadow = false;
            this.scene.add(sunMesh);
        }
    }

    async _loadAssetsAndSetupGame() {
        const pathsToLoad = {
            MAZE_MODEL_PATH: MAZE_MODEL_PATH,
            CHARACTER_BASE_MODEL_PATH: CHARACTER_BASE_MODEL_PATH,
            ANIMATION_PATHS: ANIMATION_PATHS,
            ENEMY_001_MODEL_PATH: ENEMY_001_MODEL_PATH,
            ENEMY_001_ANIMATIONS: ENEMY_001_ANIMATIONS,
            ENEMY_001_SCALE: ENEMY_001_SCALE,

            // Enemy_002 のアセットパスを追加
            ENEMY_002_MODEL_PATH: ENEMY_002_MODEL_PATH,
            ENEMY_002_ANIMATIONS: ENEMY_002_ANIMATIONS,
            ENEMY_002_SCALE: ENEMY_002_SCALE,

        };
        const loadedAssets = await this.assetLoader.loadAll(pathsToLoad);

        // --- 迷路モデルのセットアップ ---
        if (loadedAssets.mazeModel) {
            this.world.mazeModel = loadedAssets.mazeModel;
            this.scene.add(this.world.mazeModel);
            this.world.mazeModel.updateMatrixWorld(true);
            let floorObjectFound = false;
            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true; child.receiveShadow = true;
                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true;
                        this.world.collidables.push(child);
                        this.raycastTargets.push(child);
                        this.physicsManager.createWallPhysicsBody(child, child.name.includes('_Slope_'));
                    } else if (child.name === 'MazeFloor') {
                        this.world.mazeFloor = child;
                        this.world.collidables.push(child);
                        this.physicsManager.createWallPhysicsBody(child, false);
                        floorObjectFound = true;
                        this.mazeFloorMaxY = new THREE.Box3().setFromObject(child).max.y;
                    }
                }
            });
            if (!floorObjectFound) console.warn("警告: 'MazeFloor' という名前の床オブジェクトが見つかりませんでした。");
        } else {
            throw new Error("迷路モデルの読み込みに失敗しました。");
        }

        // --- キャラクターのセットアップ ---
        if (loadedAssets.characterBaseModel && loadedAssets.animations) {
            this.character = new Character(
                loadedAssets.characterBaseModel, loadedAssets.animations,
                this.scene, this.physicsManager,
                CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD, this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);
        } else {
            throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。");
        }

        // --- その他のオブジェクトのセットアップ ---
        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);
        this.ramielManager.createRamiels(NUM_RAMIELS, this.world.mazeModel, this.mazeFloorMaxY);

        // --- 敵キャラクターのセットアップ ---
        if (this.enemyManager) {
            try {
                await this.enemyManager.initEnemyAssets(loadedAssets);
                this.enemyManager.createEnemiesOfType('enemy_001');
                this.enemyManager.createEnemiesOfType('enemy_002');
            } catch (error) {
                console.error("Game: Error during enemy setup in _loadAssetsAndSetupGame:", error);
                if (this.loadingMessageElement) {
                    this.loadingMessageElement.textContent = 'エラー: 敵キャラクターのセットアップに失敗しました。';
                    this.loadingMessageElement.style.display = 'block';
                }
            }
        } else {
            console.warn("Game: EnemyManager not available. Skipping enemy creation.");
        }

        this.cameraManager.setInitialCameraState(this.character.model);
        if (this.minimap) {
            if (this.world.mazeFloor) {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, this.world.mazeFloor);
            } else {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null);
            }
        }
        this.updateGameStatusUI(); // アセットロード後にもUI更新
    }

    _onCharacterAnimationFinished(finishedActionName) {
        if (finishedActionName === 'kick') {
            if (this.character) this.character.canPlayAction = true;
        }
        if (this.character && this.character.canPlayAction) {
            if (!this.character.isMoving && this.character.currentActionName !== 'idle') {
                this.character.switchAnimation('idle');
            } else if (this.character.isMoving && this.character.currentActionName !== 'run') {
                this.character.switchAnimation('run');
            }
        }
    }

    // ゲームステータスUIを更新するメソッド
    updateGameStatusUI() {
        if (this.scoreValueElement) {
            this.scoreValueElement.textContent = this.totalScore.toString();
        }
        if (this.powerUpLevelValueElement) {
            this.powerUpLevelValueElement.textContent = this.characterPowerUpLevel.toString();
        }
        if (this.spheresRemainingElement) {
            this.spheresRemainingElement.textContent = this.spheresRemaining.toString();
        }
        if (this.ramielsRemainingElement) {
            this.ramielsRemainingElement.textContent = this.ramielsRemaining.toString();
        }
        if (this.enemies001RemainingElement) {
            this.enemies001RemainingElement.textContent = this.enemies001Remaining.toString();
        }
        if (this.enemies002RemainingElement) {
            this.enemies002RemainingElement.textContent = this.enemies002Remaining.toString();
        }
        // (他の敵タイプのUI更新も将来追加する場合はここに追加)
    }

    // オブジェクト破壊時の処理を一元化するメソッド
    handleObjectDestroyed(objectType, points) {
        this.totalScore += points;

        switch(objectType) {
            case 'sphere':
                if (this.spheresRemaining > 0) this.spheresRemaining--;
                break;
            case 'ramiel':
                if (this.ramielsRemaining > 0) this.ramielsRemaining--;
                break;
            case 'enemy_001': // Enemyクラスのconfig.KEYと一致させる
                if (this.enemies001Remaining > 0) this.enemies001Remaining--;
                break;

            case 'enemy_002': // EnemyManager の getEnemyTypeConfig で設定した KEY と一致させる
                if (this.enemies002Remaining > 0) this.enemies002Remaining--;
                break;
            // 他の敵タイプが増えたら case を追加
        }

        this.updateGameStatusUI();
        // console.log(`Object type '${objectType}' destroyed. Score: ${this.totalScore}`);

        // パワーアップ判定
        if (this.character && this.character.isAlive) {
            if (this.characterPowerUpLevel === 0 && this.totalScore >= CHARACTER_POWERUP_LEVEL_1_SCORE) {
                console.log("Game.handleObjectDestroyed: Power up condition met for Level 1! Score:", this.totalScore);
                this.powerUpCharacter(1);
                // 次のパワーアップ目標を設定
                this.nextPowerUpScore = CHARACTER_POWERUP_LEVEL_2_SCORE;
            } else if (this.characterPowerUpLevel === 1 && this.totalScore >= this.nextPowerUpScore) { // nextPowerUpScore は CHARACTER_POWERUP_LEVEL_2_SCORE
                console.log("Game.handleObjectDestroyed: Power up condition met for Level 2! Score:", this.totalScore);
                this.powerUpCharacter(2);
                // 次のパワーアップ目標を設定
                this.nextPowerUpScore = CHARACTER_POWERUP_LEVEL_3_SCORE;
            } else if (this.characterPowerUpLevel === 2 && this.totalScore >= this.nextPowerUpScore) { // nextPowerUpScore は CHARACTER_POWERUP_LEVEL_3_SCORE
                console.log("Game.handleObjectDestroyed: Power up condition met for Level 3! Score:", this.totalScore);
                this.powerUpCharacter(3);
                // 次のパワーアップ目標を設定
                this.nextPowerUpScore = CHARACTER_POWERUP_LEVEL_4_SCORE;
            } else if (this.characterPowerUpLevel === 3 && this.totalScore >= this.nextPowerUpScore) { // nextPowerUpScore は CHARACTER_POWERUP_LEVEL_4_SCORE
                console.log("Game.handleObjectDestroyed: Power up condition met for Level 4! Score:", this.totalScore);
                this.powerUpCharacter(4);
                this.nextPowerUpScore = Infinity; // これ以上のスコアパワーアップはない
            }
            // さらに多くのパワーアップレベルを追加する場合はここに追加
        }
     }

    // キャラクターをパワーアップさせるメソッド
    powerUpCharacter(level) {
        if (!this.character) {
            console.warn("Game.powerUpCharacter: Character instance not found.");
            return;
        }
        // 既にそのレベル以上にパワーアップしている場合は何もしない (オプション)
        // if (this.character.currentPowerLevel >= level) {
        //     console.log(`Game.powerUpCharacter: Character already at or above level ${level}.`);
        //     return;
        // }

        this.characterPowerUpLevel = level; // Gameクラス側でも現在のパワーアップレベルを更新
        console.log(`Game: Character powering up to Level ${this.characterPowerUpLevel}!`);

        console.log(`Game.powerUpCharacter: Attempting to power up to Level ${level}. Current char level: ${this.character.currentPowerLevel}`); // 追加


        // CharacterクラスのapplyPowerUpメソッドを呼び出して、具体的なパワーアップ処理を委譲
        this.character.applyPowerUp(this.characterPowerUpLevel);

        // (オプション) パワーアップエフェクトを再生
        if (this.effectManager && this.character.model) {
            // 適切なパワーアップエフェクトを EffectManager に依頼
            // this.effectManager.createPowerUpEffect(this.character.model.position.clone());
            // console.log("Game: Power up effect should play here.");
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const fixedTimeStep = 1.0 / 60.0;

        if (!this.gameStarted) {
            this.renderer.clear();
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            if (MINIMAP_ENABLED && this.minimap && this.character && this.character.model) {
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return;
        }

        if (this.inputManager.consumeSpacePress()) {
            if (this.character) this.character.startKickAction();
        }

        if (this.character) {
            this.character.update(delta, this.inputManager, this.cameraManager.getMainCamera(), CHARACTER_SPEED, CHARACTER_ROTATION_SPEED);
        }

        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep);

        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }
        this.sphereManager.syncAllSpheres(this.tempTransform);
        this.ramielManager.syncAllRamiels(this.tempTransform);

        if (this.enemyManager) {
            this.enemyManager.update(delta);
        }

        // ▼▼▼ ビーム発射ロジックの変更 ▼▼▼
        if (this.character && this.character.currentActionName === 'kick' &&
            this.character.kickActionStartTime !== null) { // beamGeneratedDuringKick のチェックは Character 側に移譲

            const elapsedSinceKickStart = (performance.now() - this.character.kickActionStartTime) / 1000;

            if (elapsedSinceKickStart >= KICK_BEAM_DELAY) {
                // 本体ビームの発射
                if (!this.character.beamGeneratedDuringKick) { // 本体がまだ発射していなければ
                    this.character.fireMainBeam();
                    // 効果音は本体が発射したタイミングで一度だけ鳴らす（現状維持）
                    if (this.sfxBeamLoaded && this.sfxBeamSound) {
                        if (this.sfxBeamSound.isPlaying) this.sfxBeamSound.stop();
                        this.sfxBeamSound.play();
                    }
                }

                // 分身ビームの発射 (KICK_BEAM_DELAY を共有)
                // Characterクラス側で各分身がまだ発射していないかチェックする
                this.character.fireCloneBeams();
            }
        }
        // ▲▲▲ ビーム発射ロジックの変更 ▲▲▲

        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(this.character.model, this.character.isMoving, this.inputManager);
        }

        this.effectManager.update(delta);

        this.projectileManager.update(delta, (hitObject, projectile, hitPoint, distanceToHit, intersection) => {
            if (hitObject.userData && hitObject.userData.isWall) {
                if (this.effectManager && intersection.face && intersection.face.normal) {
                    const worldNormal = intersection.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hitObject.matrixWorld)).normalize();
                    this.effectManager.createImpactEffect(hitPoint.clone(), worldNormal);
                }
                return "stop_and_adjust";
            }

            if (this.sphereManager.isSphere(hitObject)) {
                if (projectile.userData.hitSpheresThisFrame && !projectile.userData.hitSpheresThisFrame.has(hitObject.uuid)) {
                    if (this.effectManager && hitObject.material && typeof hitObject.material.color !== 'undefined') {
                        const sphereColor = hitObject.material.color.clone();
                        this.effectManager.createSparkExplosion(hitObject.position.clone(), sphereColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(hitObject.position.clone(), sphereColor);
                    }
                    this.sphereManager.destroySphereByMesh(hitObject);
                    projectile.userData.hitSpheresThisFrame.add(hitObject.uuid);
                    this.handleObjectDestroyed('sphere', SPHERE_SCORE); // スコアカウント
                    return "destroy_target_and_continue";
                } else { return "ignore"; }
            }

            if (this.ramielManager.isRamiel(hitObject)) {
                const ramielData = this.ramielManager.ramiels.find(r => r.mainMesh === hitObject);
                let wasDestroyedThisHit = false;
                if (ramielData && ramielData.isAlive) {
                    wasDestroyedThisHit = this.ramielManager.applyDamage(hitObject, BEAM_DAMAGE);
                }

                if (this.effectManager && RAMIEL_AT_FIELD_ENABLED) {
                    const ramielPosition = hitObject.position.clone();
                    const charPos = this.character.model.position.clone();
                    let dirToChar = charPos.sub(ramielPosition);
                    dirToChar.y = 0; dirToChar.normalize();
                    const atFieldPos = ramielPosition.clone().addScaledVector(dirToChar, RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL);
                    atFieldPos.y = ramielPosition.y;
                    this.effectManager.createRamielATFieldEffect(atFieldPos, dirToChar, true);
                }

                if (wasDestroyedThisHit && ramielData && !ramielData.scoreAwarded) {
                    this.handleObjectDestroyed('ramiel', RAMIEL_SCORE);
                    ramielData.scoreAwarded = true;
                    if (this.effectManager) {
                        const rPos = hitObject.position.clone();
                        const gPos = new THREE.Vector3(rPos.x, this.world.mazeFloor ? this.mazeFloorMaxY : rPos.y - (RAMIEL_SIZE * 0.707), rPos.z);
                        const rColor = new THREE.Color(RAMIEL_COLOR);
                        this.effectManager.createSparkExplosion(rPos, rColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(rPos, rColor);
                        this.effectManager.createRamielCrossExplosion(gPos);
                    }

                   // ラミエルを実際に破壊する処理を呼び出す
                   this.ramielManager.destroyRamielByMesh(hitObject);

                } else if (ramielData && !ramielData.isAlive && !ramielData.scoreAwarded) {
                     this.handleObjectDestroyed('ramiel', RAMIEL_SCORE); // 既に死んでてスコア未処理の場合
                     ramielData.scoreAwarded = true;

                   this.ramielManager.destroyRamielByMesh(hitObject);


                }
                return "stop_and_adjust";
            }

            if (this.enemyManager && this.enemyManager.isEnemy(hitObject)) {
                const enemy = this.enemyManager.getEnemyByMesh(hitObject);
                if (enemy && enemy.isAlive) {
                    const wasDamaged = enemy.applyDamage(BEAM_DAMAGE);
                    if (this.effectManager && hitObject.material) {
                        this.effectManager.createSparkExplosion(hitPoint.clone(), new THREE.Color(0xffaa00));
                    }

                    // ▼▼▼ ATフィールドエフェクト生成条件を変更 ▼▼▼
                    if (wasDamaged &&
                        ENEMY_GENERIC_AT_FIELD_ENABLED && // 全体のマスターフラグ (オプション)
                        enemy.config.USE_GENERIC_AT_FIELD && // 敵ごとのフラグ
                        this.effectManager &&
                        this.character && this.character.model) {
                    // ▲▲▲ ATフィールドエフェクト生成条件を変更 ▲▲▲
                        const enemyPos = enemy.model.position.clone();
                        const effectRadius = enemy.config.RADIUS * ENEMY_GENERIC_AT_FIELD_RADIUS_FACTOR;
                        let dirFromPlayer = enemyPos.clone().sub(this.character.model.position);
                        dirFromPlayer.y = 0;
                        if (dirFromPlayer.lengthSq() < 0.001) dirFromPlayer.set(0,0,1);
                        dirFromPlayer.normalize();
                        const effectPos = new THREE.Vector3(enemyPos.x, enemyPos.y + enemy.config.HEIGHT * ENEMY_GENERIC_AT_FIELD_OFFSET_Y_FACTOR, enemyPos.z)
                            .addScaledVector(dirFromPlayer, -effectRadius * ENEMY_GENERIC_AT_FIELD_OFFSET_HORIZONTAL_FACTOR);
                        this.effectManager.createGenericWaveATFieldEffect(
                            effectPos, dirFromPlayer, effectRadius, ENEMY_GENERIC_AT_FIELD_COLOR,
                            ENEMY_GENERIC_AT_FIELD_INITIAL_OPACITY, ENEMY_GENERIC_AT_FIELD_NUM_RINGS,
                            ENEMY_GENERIC_AT_FIELD_RING_DURATION, ENEMY_GENERIC_AT_FIELD_SPAWN_INTERVAL,
                            ENEMY_GENERIC_AT_FIELD_START_SCALE, ENEMY_GENERIC_AT_FIELD_END_SCALE_FACTOR,
                            ENEMY_GENERIC_AT_FIELD_RING_THICKNESS_RATIO,
                            ENEMY_GENERIC_AT_FIELD_FADE_OUT_START_RATIO_PER_RING
                        );
                    }
                    if (wasDamaged && !enemy.isAlive && !enemy.scoreAwarded) {
                        this.handleObjectDestroyed(enemy.config.KEY, enemy.config.SCORE); // KEYとSCOREを使用
                        enemy.scoreAwarded = true;
                    }
                    return "stop_and_adjust";
                } else { return "ignore"; }
            }
            return "ignore";
        });

        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera());
        }
        if (MINIMAP_ENABLED && this.minimap && this.character && this.character.model) {
            this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
        }
    }

    _onWindowResize() {
        if (!this.cameraManager || !this.renderer) return;
        const mainCamera = this.cameraManager.getMainCamera();
        if (!mainCamera) return;
        mainCamera.aspect = window.innerWidth / window.innerHeight;
        mainCamera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.minimap) this.minimap.onWindowResize();
    }
}

export { Game };

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init().catch(error => {
        console.error("Failed to initialize game from DOMContentLoaded:", error);
        const loadingMessageElement = document.getElementById('loading-message');
        if (loadingMessageElement) {
            loadingMessageElement.textContent = 'ゲームの起動に失敗しました。コンソールを確認してください。';
            loadingMessageElement.style.display = 'block';
        }
        const startGameMessageElement = document.getElementById('start-game-message');
        if (startGameMessageElement) {
            startGameMessageElement.style.display = 'none';
        }
    });
});