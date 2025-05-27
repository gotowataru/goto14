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
    NUM_SPHERES, MAZE_SCALE, MINIMAP_ENABLED,
    MINIMAP_INDICATOR_Y_OFFSET,
    NUM_RAMIELS, RAMIEL_COLOR,RAMIEL_SIZE,
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
        this.raycastTargets = []; // 壁、敵、その他インタラクティブなオブジェクトのメッシュ/グループ
        this.mazeFloorMaxY = 0;
        this.gameStarted = false;
        this.tempTransform = null; // Ammo.js 用

        // --- DOM要素の取得 ---
        this.startGameMessageElement = document.getElementById('start-game-message');
        this.loadingMessageElement = document.getElementById('loading-message');
        this.bgmVolumeSlider = document.getElementById('bgm-volume-slider');
        this.bgmVolumeValueSpan = document.getElementById('bgm-volume-value');
        this.sfxVolumeSlider = document.getElementById('sfx-volume-slider');
        this.sfxVolumeValueSpan = document.getElementById('sfx-volume-value');

        // --- 各マネージャーのインスタンス化 ---
        this.inputManager = new InputManager(this.renderer.domElement);
        this.physicsManager = new PhysicsManager(GRAVITY);
        this.assetLoader = new AssetLoader();
        this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.world.collidables);
        this.effectManager = new EffectManager(this.scene);
        this.projectileManager = new ProjectileManager(this.scene, () => this.raycastTargets, this.effectManager);
        this.sphereManager = new SphereManager(this.scene, this.physicsManager, this.raycastTargets);
        this.ramielManager = new RamielManager(this.scene, this.physicsManager, this.raycastTargets);
        this.enemyManager = null; // init でインスタンス化

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
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // よりソフトな影
        document.body.appendChild(this.renderer.domElement);
        // console.log("Renderer setup complete.");
    }

    async init() {
        try {
            // console.log("Game init started.");
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");
            // console.log("PhysicsManager Ammo initialized.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();
            // console.log("PhysicsManager world initialized.");

            // EnemyManagerのインスタンス化 (PhysicsManagerとAssetLoaderの後)
            this.enemyManager = new EnemyManager(
                this.scene,
                this.physicsManager,
                this.effectManager,
                this.assetLoader, // AssetLoaderのインスタンス自体は渡さない方針に変更 (EnemyManagerはロード済みアセットを受け取るため)
                                  // ただし、EnemyManagerが将来的に動的ロードする場合を考慮して渡す設計もあり得る
                                  // 現状のEnemyManagerはコンストラクタでassetLoaderを直接使用していない
                this.raycastTargets, // raycastTargets配列への参照を渡す
                () => this.character // characterインスタンスへの参照を返すゲッター関数を渡す
            );
            // console.log("EnemyManager instantiated.");

            // --- ボリュームスライダーの初期設定とイベントリスナー ---
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
            // console.log("Volume sliders setup.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '3Dシーン環境を初期化中...';
            this._initThreeJSEnvironment();
            // console.log("Three.js environment initialized.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'アセットを読み込み中...';
            await this._loadAssetsAndSetupGame(); // ここでアセットロードと主要オブジェクトのセットアップ
            // console.log("Assets loaded and game objects setup.");

            // オーディオのセットアップ (カメラとアセットロード後)
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.cameraManager.getMainCamera().add(this.audioListener);
                // console.log("AudioListener added to the main camera.");

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(BGM_PATH, (buffer) => {
                    this.bgmSound = new THREE.Audio(this.audioListener);
                    this.bgmSound.setBuffer(buffer);
                    this.bgmSound.setLoop(BGM_LOOP);
                    const currentSliderVolume = this.bgmVolumeSlider ? parseFloat(this.bgmVolumeSlider.value) : BGM_VOLUME;
                    this.bgmSound.setVolume(currentSliderVolume);
                    this.bgmLoaded = true;
                    // console.log('BGM loaded successfully.');
                    this._checkAllAudioLoadedAndProceed();
                }, (xhr) => {
                    if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                        const percentLoaded = Math.round(xhr.loaded / xhr.total * 100);
                        this.loadingMessageElement.textContent = `BGMを読み込み中... ${percentLoaded}%`;
                    }
                }, (error) => {
                    console.error('BGMの読み込みに失敗しました:', error);
                    if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) this.loadingMessageElement.textContent = 'BGMの読み込みに失敗。';
                    this.bgmLoaded = true; // エラーでも次に進むためにフラグを立てる
                    this._checkAllAudioLoadedAndProceed();
                });

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(SFX_BEAM_PATH, (buffer) => {
                    this.sfxBeamSound = new THREE.Audio(this.audioListener);
                    this.sfxBeamSound.setBuffer(buffer);
                    this.sfxBeamSound.setLoop(SFX_BEAM_LOOP);
                    const currentSfxSliderVolume = this.sfxVolumeSlider ? parseFloat(this.sfxVolumeSlider.value) : SFX_BEAM_VOLUME;
                    this.sfxBeamSound.setVolume(currentSfxSliderVolume);
                    this.sfxBeamLoaded = true;
                    // console.log('SFX (beam) loaded successfully.');
                    this._checkAllAudioLoadedAndProceed();
                }, undefined, (error) => {
                    console.error('SFX (beam) の読み込みに失敗しました:', error);
                     if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('効果音')) this.loadingMessageElement.textContent = '効果音の読み込みに失敗。';
                    this.sfxBeamLoaded = true; // エラーでも次に進むためにフラグを立てる
                    this._checkAllAudioLoadedAndProceed();
                });
            } else {
                console.error("Main camera not available, cannot add AudioListener or load audio.");
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'カメラの準備ができず、音声を読み込めません。';
                // カメラがない場合は音声なしで進むか、エラーとするか
                this.bgmLoaded = true; this.sfxBeamLoaded = true; // 強制的にフラグを立てて次に進める
                this._checkAllAudioLoadedAndProceed();
            }

            // _checkAllAudioLoadedAndProceed からUI更新とアニメーション開始が呼ばれる

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
            // console.log("All audio (BGM and SFX) loading attempts finished.");
            if (this.loadingMessageElement) this.loadingMessageElement.style.display = 'none';
            if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'block';
            // console.log("Start game message displayed.");

            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
            // console.log("Keydown listener for game start added.");

            window.addEventListener('resize', this._onWindowResize.bind(this));
            this.animate(); // アニメーションループを開始
            // console.log("Game init finished. Animation loop started.");
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
            // console.log("Game started by Enter key!");
        } else {
            // Enterキー以外が押された場合は、再度リスナーを設定してEnterを待つ
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
        }
    }

    _tryPlayBGM() {
        if (!this.bgmLoaded || !this.bgmSound || this.bgmSound.isPlaying) return;

        // AudioContextがユーザーインタラクションなしに自動再生できない場合があるため、ここでresumeを試みる
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume().then(() => {
                // console.log("AudioContext resumed by user interaction (BGM).");
                if(this.bgmSound && !this.bgmSound.isPlaying) {
                    this.bgmSound.play();
                    // console.log("BGM playback started after AudioContext resume.");
                }
            }).catch(e => console.error("Error resuming AudioContext for BGM:", e));
        } else {
            if(this.bgmSound && !this.bgmSound.isPlaying) {
                this.bgmSound.play();
                // console.log("BGM playback started.");
            }
        }
    }

    _initThreeJSEnvironment() {
        this.scene.background = new THREE.Color(0x6699cc); // 空の色
        this.scene.fog = new THREE.Fog(0x6699cc, 800 * MAZE_SCALE, 2500 * MAZE_SCALE); // 霧

        // 環境光
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.8);
        hemiLight.position.set(0, 250 * MAZE_SCALE, 0);
        this.scene.add(hemiLight);

        // 平行光源 (太陽光)
        const dirLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
        dirLight.position.copy(SUN_POSITION); // constants.jsから太陽の位置を設定
        dirLight.castShadow = DIRECTIONAL_LIGHT_CAST_SHADOW; // 影を生成

        // シャドウマップの設定
        dirLight.shadow.camera.top = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.left = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.right = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
        dirLight.shadow.camera.far = SHADOW_CAMERA_FAR;
        dirLight.shadow.mapSize.width = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH;
        dirLight.shadow.mapSize.height = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT;
        dirLight.shadow.bias = DIRECTIONAL_LIGHT_SHADOW_BIAS; // シャドウアクネ対策

        this.scene.add(dirLight);
        this.scene.add(dirLight.target); //ターゲットもシーンに追加

        // 太陽の3Dオブジェクト (オプション)
        if (SUN_ENABLED) {
            const sunGeometry = new THREE.SphereGeometry(SUN_SIZE, 32, 32);
            const sunMaterial = new THREE.MeshStandardMaterial({
                emissive: SUN_COLOR, // 自己発光色
                emissiveIntensity: SUN_EMISSIVE_INTENSITY, // 自己発光の強度
                color: SUN_COLOR, // 基本色 (emissiveと合わせることが多い)
                metalness: 0.0,   // 金属っぽさ (非金属)
                roughness: 1.0,   // 粗さ (マットな感じ)
                fog: false        // 霧の影響を受けない
            });
            const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
            sunMesh.position.copy(SUN_POSITION);
            sunMesh.castShadow = false;      // 太陽自体は影を落とさない
            sunMesh.receiveShadow = false;   // 太陽自体は影を受けない
            this.scene.add(sunMesh);
        }
    }

    async _loadAssetsAndSetupGame() {
        // console.log("Game: _loadAssetsAndSetupGame started.");
        // AssetLoaderに渡すパスオブジェクトを構築
        // AssetLoader.js の実装に合わせて、ANIMATION_PATHS と ENEMY_001_ANIMATIONS は
        // オブジェクトのまま渡し、ENEMY_001_SCALE も含める。
        const pathsToLoad = {
            MAZE_MODEL_PATH: MAZE_MODEL_PATH,
            CHARACTER_BASE_MODEL_PATH: CHARACTER_BASE_MODEL_PATH,
            ANIMATION_PATHS: ANIMATION_PATHS, // キャラクターアニメーションはオブジェクトのまま

            // --- Enemy_001 アセットのパスとスケールを追加 ---
            ENEMY_001_MODEL_PATH: ENEMY_001_MODEL_PATH,
            ENEMY_001_ANIMATIONS: ENEMY_001_ANIMATIONS, // 敵アニメーションもオブジェクトのまま
            ENEMY_001_SCALE: ENEMY_001_SCALE,          // 敵のスケール値も渡す
        };
        // 将来的に enemy_002 などが追加された場合、同様に ENEMY_002_MODEL_PATH などもここに追加

        // console.log("Game: Paths to load for AssetLoader:", pathsToLoad);

        const loadedAssets = await this.assetLoader.loadAll(pathsToLoad);
        // console.log("Game: Assets loaded by AssetLoader:", loadedAssets);

        // --- 迷路モデルのセットアップ ---
        if (loadedAssets.mazeModel) {
            this.world.mazeModel = loadedAssets.mazeModel;
            this.scene.add(this.world.mazeModel);
            this.world.mazeModel.updateMatrixWorld(true); // 明示的なワールド行列の更新
            let floorObjectFound = false;
            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true; // 壁であることを示すフラグ
                        this.world.collidables.push(child); // カメラの衝突判定用
                        this.raycastTargets.push(child);    // ビームの衝突判定用
                        const isSlopeObject = child.name.includes('_Slope_'); // スロープオブジェクトか判定
                        this.physicsManager.createWallPhysicsBody(child, isSlopeObject);
                    } else if (child.name === 'MazeFloor') {
                        this.world.mazeFloor = child;
                        this.world.collidables.push(child); // カメラの衝突判定用
                        // this.raycastTargets.push(child); // 床はビームが貫通しても良いので、ターゲットにしない場合も
                        this.physicsManager.createWallPhysicsBody(child, false); // 床はスロープではない
                        floorObjectFound = true;
                        // 床のY座標の最大値を取得 (ミニマップやオブジェクト配置の基準に使用)
                        const boundingBox = new THREE.Box3().setFromObject(child);
                        this.mazeFloorMaxY = boundingBox.max.y;
                        // console.log(`MazeFloor found. Max Y: ${this.mazeFloorMaxY.toFixed(2)}, Min Y: ${boundingBox.min.y.toFixed(2)}`);
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
                loadedAssets.characterBaseModel, // FBXLoaderでロードされたモデル
                loadedAssets.animations,         // FBXLoaderでロードされたアニメーションクリップのマップ {idle: clip, run: clip, ...}
                this.scene, this.physicsManager,
                CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD, this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);
            // console.log("Player character created.");
        } else {
            throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。");
        }

        // --- その他のオブジェクトのセットアップ ---
        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);
        // console.log("Spheres created.");
        this.ramielManager.createRamiels(NUM_RAMIELS, this.world.mazeModel, this.mazeFloorMaxY);
        // console.log("Ramiels created.");

        // --- 敵キャラクターのセットアップ ---
        if (this.enemyManager) {
            try {
                // AssetLoaderがロードした全アセット(loadedAssets)を渡して、
                // EnemyManager内部で必要な敵アセットを整理・保持させる。
                await this.enemyManager.initEnemyAssets(loadedAssets);

                // その後、敵タイプを指定して生成を指示
                this.enemyManager.createEnemiesOfType('enemy_001');
                // 必要に応じて他の敵タイプも生成できる
                // this.enemyManager.createEnemiesOfType('enemy_002'); // 将来的に

                // console.log("Game: Enemies setup via EnemyManager complete.");
            } catch (error) {
                console.error("Game: Error during enemy setup in _loadAssetsAndSetupGame:", error);
                if (this.loadingMessageElement) {
                    this.loadingMessageElement.textContent = 'エラー: 敵キャラクターのセットアップに失敗しました。';
                    this.loadingMessageElement.style.display = 'block';
                }
                // throw error; // 必要ならここでエラーを再スローしてinit全体を失敗させる
            }
        } else {
            console.warn("Game: EnemyManager not available. Skipping enemy creation.");
        }
        // --- 敵キャラクターのセットアップここまで ---

        // --- カメラの初期設定 ---
        this.cameraManager.setInitialCameraState(this.character.model);

        // --- ミニマップのセットアップ ---
        if (this.minimap) {
            if (this.world.mazeFloor) {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, this.world.mazeFloor);
            } else {
                console.warn("Minimap: 床オブジェクトが見つからないため、ミニマップカメラのセットアップをスキップしました。");
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null); // 床なしで試みる
            }
            // console.log("Minimap setup.");
        }

        // console.log("Game: _loadAssetsAndSetupGame: Final raycastTargets list count:", this.raycastTargets.length);
        // console.log("Game: _loadAssetsAndSetupGame finished.");
    }

    _onCharacterAnimationFinished(finishedActionName) {
        // キックアニメーションが終了したら、再度アクション可能にする
        if (finishedActionName === 'kick') {
            if (this.character) this.character.canPlayAction = true;
        }
        // アクション中でなく、移動もしていないならアイドルに、移動中ならランに戻す汎用的な処理
        if (this.character && this.character.canPlayAction) { // アクション可能状態であること
            if (!this.character.isMoving && this.character.currentActionName !== 'idle') {
                this.character.switchAnimation('idle');
            } else if (this.character.isMoving && this.character.currentActionName !== 'run') {
                this.character.switchAnimation('run');
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const fixedTimeStep = 1.0 / 60.0; // 物理演算の固定ステップ時間

        // ゲーム開始前はレンダリングのみ行うか、特定の画面を表示
        if (!this.gameStarted) {
            this.renderer.clear();
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            // ゲーム開始前もミニマップは更新・表示してよい場合
            if (MINIMAP_ENABLED && this.minimap && this.character && this.character.model) {
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return;
        }

        // --- 入力処理 ---
        if (this.inputManager.consumeSpacePress()) { // スペースキーが押されたか（消費型）
            if (this.character && this.character.startKickAction()) {
                // キックアクション開始成功時の処理 (特に無し)
            }
        }

        // --- キャラクターの更新 ---
        if (this.character) {
            this.character.update(delta, this.inputManager, this.cameraManager.getMainCamera(), CHARACTER_SPEED, CHARACTER_ROTATION_SPEED);
        }

        // --- 物理演算のステップ実行 ---
        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep); // 最大2サブステップ

        // --- 物理演算結果をThree.jsモデルに同期 ---
        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }
        this.sphereManager.syncAllSpheres(this.tempTransform);
        this.ramielManager.syncAllRamiels(this.tempTransform);

        // --- 敵の更新と物理同期 ---
        if (this.enemyManager) {
            this.enemyManager.update(delta); // これの中で各EnemyのupdateとsyncPhysicsToModelが呼ばれる
        }

        // --- ビーム発射ロジック (キックアニメーションと連動) ---
        if (this.character && this.character.currentActionName === 'kick' &&
            this.character.kickActionStartTime !== null && !this.character.beamGeneratedDuringKick) {
            const elapsedSinceKickStart = (performance.now() - this.character.kickActionStartTime) / 1000;
            if (elapsedSinceKickStart >= KICK_BEAM_DELAY) {
                const worldForward = this.character.localForwardDirection.clone().applyQuaternion(this.character.model.quaternion);

                this.projectileManager.createRings(this.character.model, worldForward); // リングエフェクト
                this.projectileManager.createBeam( // ビーム本体
                    this.character.model,
                    worldForward,
                    CHARACTER_HEIGHT,
                    BEAM_SPAWN_OFFSET_FORWARD,
                    MAKANKO_BEAM_TYPE_ENABLED, // 魔貫光殺砲タイプか通常ビームか
                );

                this.character.beamGeneratedDuringKick = true; // このキックではビーム生成済み
                // ビーム効果音の再生
                if (this.sfxBeamLoaded && this.sfxBeamSound) {
                    if (this.sfxBeamSound.isPlaying) this.sfxBeamSound.stop();
                    this.sfxBeamSound.play();
                }
            }
        }

        // --- カメラの更新 ---
        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(this.character.model, this.character.isMoving, this.inputManager);
        }

        // --- エフェクトの更新 ---
        this.effectManager.update(delta);

        // --- プロジェクタイル (ビーム) の更新と衝突判定 ---
        this.projectileManager.update(delta, (hitObject, projectile, hitPoint, distanceToHit, intersection) => {
            // デバッグ用ログ (必要に応じてコメント解除)
            // if (this.enemyManager) {
            //     const potentialEnemy = this.enemyManager.getEnemyByMesh(hitObject);
            //     console.log("Beam hit object:", hitObject.name, "(UUID:", hitObject.uuid, ")");
            //     if (potentialEnemy) { console.log("It's an enemy:", potentialEnemy.config.KEY, "Model UUID:", potentialEnemy.model.uuid); }
            // }

            // --- 壁への衝突 ---
            if (hitObject.userData && hitObject.userData.isWall) {
                if (this.effectManager && intersection.face && intersection.face.normal) {
                    const worldNormal = intersection.face.normal.clone();
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitObject.matrixWorld);
                    worldNormal.applyMatrix3(normalMatrix).normalize();
                    this.effectManager.createImpactEffect(hitPoint.clone(), worldNormal); // 壁ヒットエフェクト
                }
                return "stop_and_adjust"; // ビームを停止し、先端を衝突点に調整
            }
            // --- 球への衝突 ---
            if (this.sphereManager.isSphere(hitObject)) {
                // 1フレーム中に同じ球に複数回ヒットしないようにチェック (貫通型ビームの場合)
                if (projectile.userData.hitSpheresThisFrame && !projectile.userData.hitSpheresThisFrame.has(hitObject.uuid)) {
                    if (this.effectManager && hitObject.material && typeof hitObject.material.color !== 'undefined') {
                        const sphereColor = hitObject.material.color.clone();
                        this.effectManager.createSparkExplosion(hitObject.position.clone(), sphereColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(hitObject.position.clone(), sphereColor);
                    }
                    this.sphereManager.destroySphereByMesh(hitObject); // 球を破壊
                    projectile.userData.hitSpheresThisFrame.add(hitObject.uuid); // このフレームでヒット済みとして記録
                    return "destroy_target_and_continue"; // ターゲットを破壊し、ビームは進行継続
                } else {
                    return "ignore"; //既にヒット済みか、データ構造がおかしい場合は無視
                }
            }
            // --- Ramielへの衝突 ---
            if (this.ramielManager.isRamiel(hitObject)) {
                const wasDestroyed = this.ramielManager.applyDamage(hitObject, BEAM_DAMAGE); // ダメージ適用
                // ATフィールド風エフェクトの生成呼び出し (Ramiel専用)
                if (this.effectManager && RAMIEL_AT_FIELD_ENABLED) {
                    const ramielPosition = hitObject.position.clone();
                    const characterPosition = this.character.model.position.clone(); // プレイヤーの位置
                    const atFieldY = ramielPosition.y; // ATフィールドのY座標はラミエルと同じ
                    let directionToCharacter = characterPosition.clone().sub(ramielPosition);
                    directionToCharacter.y = 0; // 水平方向のベクトルに
                    directionToCharacter.normalize();
                    // ATフィールドの発生位置 (ラミエルとプレイヤーの間、ラミエル寄り)
                    const atFieldPosition = ramielPosition.clone().addScaledVector(directionToCharacter, RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL);
                    atFieldPosition.y = atFieldY;
                    this.effectManager.createRamielATFieldEffect(atFieldPosition, directionToCharacter.clone(), true); // isWaveEffect = true
                }
                if (wasDestroyed) { // もしRamielが破壊されたら
                    if (this.effectManager) {
                        const rPos = hitObject.position.clone();
                        const rHalfH = RAMIEL_SIZE * 0.707; // 正八面体の中心から頂点までの高さの半分程度
                        const gPos = new THREE.Vector3(rPos.x, this.world.mazeFloor ? this.world.mazeFloorMaxY : rPos.y - rHalfH, rPos.z); // 地面十字架の位置
                        const rColor = new THREE.Color(RAMIEL_COLOR);
                        this.effectManager.createSparkExplosion(rPos, rColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(rPos, rColor);
                        this.effectManager.createRamielCrossExplosion(gPos); // 十字架爆発エフェクト
                    }
                }
                return "stop_and_adjust"; // Ramielにヒットしたらビームは停止
            }

            // --- 敵 (例: enemy_001) へのヒット処理 ---
            if (this.enemyManager && this.enemyManager.isEnemy(hitObject)) {
                const enemy = this.enemyManager.getEnemyByMesh(hitObject);
                if (enemy && enemy.isAlive) { // 生きている敵か確認
                    // console.log("SUCCESS: Beam hit living enemy:", enemy.config.KEY);

                    const wasDamaged = enemy.applyDamage(BEAM_DAMAGE); // ダメージ適用

                    // 敵ヒット時のエフェクト (火花)
                    if (this.effectManager && hitObject.material) { // マテリアルがあれば色を取得試行
                        this.effectManager.createSparkExplosion(hitPoint.clone(), new THREE.Color(0xffaa00)); // オレンジ色の火花
                    }

                    // 敵に波紋ATフィールドエフェクトを生成 (ダメージを受けた場合)
                    if (wasDamaged && ENEMY_GENERIC_AT_FIELD_ENABLED && this.effectManager && this.character && this.character.model) {
                        const enemyPos = enemy.model.position.clone();
                        const effectRadius = enemy.config.RADIUS * ENEMY_GENERIC_AT_FIELD_RADIUS_FACTOR;
                        const directionFromPlayerToEnemy = enemyPos.clone().sub(this.character.model.position);
                        directionFromPlayerToEnemy.y = 0;
                        if (directionFromPlayerToEnemy.lengthSq() < 0.001) directionFromPlayerToEnemy.set(0, 0, 1);
                        directionFromPlayerToEnemy.normalize();

                        const effectPosition = new THREE.Vector3(
                            enemyPos.x,
                            enemyPos.y + enemy.config.HEIGHT * ENEMY_GENERIC_AT_FIELD_OFFSET_Y_FACTOR,
                            enemyPos.z
                        );
                        const horizontalOffsetAmount = effectRadius * ENEMY_GENERIC_AT_FIELD_OFFSET_HORIZONTAL_FACTOR;
                        effectPosition.addScaledVector(directionFromPlayerToEnemy, -horizontalOffsetAmount);

                        this.effectManager.createGenericWaveATFieldEffect(
                            effectPosition, directionFromPlayerToEnemy, effectRadius,
                            ENEMY_GENERIC_AT_FIELD_COLOR, ENEMY_GENERIC_AT_FIELD_INITIAL_OPACITY,
                            ENEMY_GENERIC_AT_FIELD_NUM_RINGS, ENEMY_GENERIC_AT_FIELD_RING_DURATION,
                            ENEMY_GENERIC_AT_FIELD_SPAWN_INTERVAL, ENEMY_GENERIC_AT_FIELD_START_SCALE,
                            ENEMY_GENERIC_AT_FIELD_END_SCALE_FACTOR, ENEMY_GENERIC_AT_FIELD_RING_THICKNESS_RATIO,
                            ENEMY_GENERIC_AT_FIELD_FADE_OUT_START_RATIO_PER_RING
                        );
                    }

                    if (enemy.isAlive === false) { // ダメージの結果、敵が死んだ場合
                        // console.log("Game: Enemy destroyed by projectile:", enemy.config.KEY);
                        // ここで敵破壊時の特別なエフェクトなどを追加しても良い
                    }
                    return "stop_and_adjust"; // 敵にヒットしたらビームは停止 (貫通させない場合)
                } else {
                    // console.log("INFO: Beam hit an enemy, but it's not alive or getEnemyByMesh failed.");
                    return "ignore"; // 死んでいる敵や特定できない場合は無視
                }
            }
            // --- 敵へのヒット処理ここまで ---

            return "ignore"; // 上記のいずれにも該当しない場合はビームは進行 (または何もしない)
        });

        // --- レンダリング ---
        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera()); // メインビューのレンダリング
        }
        // ミニマップのレンダリング (メインレンダリングの後)
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

        if (this.minimap) this.minimap.onWindowResize(); // ミニマップもリサイズ対応
    }
}

export { Game };

// DOM読み込み完了後にゲームインスタンスを作成し初期化
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