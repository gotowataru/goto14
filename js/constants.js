// constants.js

import * as THREE from 'three';

// --- モデル・アニメーション関連 ---
export const MAZE_MODEL_PATH = './models/debug_map09.glb'; // 迷路の3Dモデルファイルのパス。変更すると読み込まれる迷路が変わります。
export const CHARACTER_BASE_MODEL_PATH = './models/idol_20250519_01.fbx'; // キャラクターの基本（アイドル状態などのベース）モデルファイルのパス。idle.fbx　box　idol_20250519_2
export const ANIMATION_PATHS = { // キャラクターのアニメーションファイルパス。各動作のアニメーションを変更します。
    idle: './models/idol_20250519_01.fbx',    // アイドル状態のアニメーション
    run: './models/run_20250519_02.fbx',   // 走行状態のアニメーションtest_run1
    kick: './models/kick_20250519_02.fbx'  // キック動作のアニメーションkick_01
    //, jump: './models/jump_01.fbx' // ジャンプは削除済みなのでこのまま
};

// --- キャラクター基本設定 ---
export const CHARACTER_INITIAL_POSITION = new THREE.Vector3(0, 1, 0); // キャラクターの初期位置 (x, y, z)。ゲーム開始時のキャラクターのスポーン地点。

export const CHARACTER_INITIAL_SCALE = 1.0; // キャラクターモデルの初期スケール。値を変更するとキャラクターのサイズが変わります。物理演算にも影響。
export const CHARACTER_SPEED = 10.0; // キャラクターの移動速度。大きいほど速く移動します。
export const CHARACTER_ROTATION_SPEED = Math.PI; // キャラクターの回転速度 (ラジアン/秒)。大きいほど旋回が速くなります。 (Math.PI = 180度/秒)
export const BASE_CHARACTER_HEIGHT = 2.0; // キャラクターモデルの基準身長（スケール1の時の身長）。CHARACTER_HEIGHTの計算に使用。
export const BASE_CHARACTER_RADIUS = 0.5; // キャラクターモデルの基準半径（スケール1の時の半径）。CHARACTER_RADIUSの計算に使用。


export const CHARACTER_HEIGHT = BASE_CHARACTER_HEIGHT * CHARACTER_INITIAL_SCALE; // 実際のキャラクターの身長 (スケール適用後)。物理カプセルの高さなどに影響。
export const CHARACTER_RADIUS = BASE_CHARACTER_RADIUS * CHARACTER_INITIAL_SCALE; // 実際のキャラクターの半径 (スケール適用後)。物理カプセルの半径などに影響。
export const CHARACTER_LOCAL_FORWARD = new THREE.Vector3(0, 0, 1); // キャラクターモデルのローカル座標系における「前」方向。モデルの向きによって調整。
// export const CHARACTER_JUMP_FORCE = 2000 * CHARACTER_INITIAL_SCALE; // ジャンプ時に加える力の大きさ (要調整)
// export const CHARACTER_JUMP_INITIAL_VELOCITY = 100 * MAZE_SCALE; // ジャンプの初速 (Y方向) (要調整)
// export const CHARACTER_MAX_JUMPS = 1; // 最大ジャンプ回数 (2段ジャンプなら2)

// --- 迷路設定 ---
export const MAZE_SCALE = 1; // 迷路モデルの全体的なスケール。迷路の大きさを調整します。他の多くの値もこれに依存する場合があります。
export const MAZE_Y_OFFSET = 0; // 迷路モデルのY軸オフセット。迷路全体の高さを調整します。

// --- カメラ設定 ---
export const CAMERA_Y_OFFSET = 2.5; // カメラのターゲット（キャラクター）からのY軸方向の基本的なオフセット量。
export const CAMERA_OFFSET = new THREE.Vector3(0, 3, 5); // キャラクターを追従するカメラの相対位置オフセット (x, y, z)。Yを大きくすると見下ろし、Zを大きくすると遠景に。
export const CAMERA_FOLLOW_SPEED = 0.08; // カメラがキャラクターを追従する際の補間速度。小さいほど滑らかに追従 (0に近いほど遅く、1に近いほど速い)。
export const CAMERA_COLLISION_OFFSET = 4.0; // カメラが壁と衝突する際のオフセット距離。カメラのめり込み防止用。
export const CAMERA_CORRECTION_LERP_SPEED = 0.15; // カメラが壁衝突から復帰する際の補間速度。
export const INITIAL_CAMERA_DISTANCE = CAMERA_OFFSET.length(); // 初期状態でのカメラとキャラクター間の距離。ズームの基準。
export const MIN_ZOOM_DISTANCE = CHARACTER_RADIUS * 1; // カメラの最小ズーム距離。これよりキャラクターに近づけない。
export const MAX_ZOOM_DISTANCE = 100 * MAZE_SCALE; // カメラの最大ズーム距離。これよりキャラクターから離れられない。
export const ZOOM_SPEED_FACTOR = 0.1; // カメラのズーム速度係数。マウスホイールなどでのズーム感度。

// --- プロジェクタイル (ビーム・リング) 設定 ---
export const BEAM_COLOR = 0xffff00; // ビームの色 (16進数カラーコード、例: 黄色)。
export const BEAM_DAMAGE = 25; // ビームの攻撃力
export const BEAM_RADIUS = 0.2 * MAZE_SCALE; // ビームの半径。ビームの太さを決定します。
export const BEAM_LENGTH = 100 * MAZE_SCALE; // ビームの視覚的な長さ。
export const BEAM_SPEED = 10 * MAZE_SCALE; // ビームの進行速度。
export const BEAM_RAYCAST_DISTANCE = BEAM_SPEED * (1.0 / 60.0) * 1.2; // ビームの1フレームあたりのレイキャスト（衝突判定）距離。貫通防止用。速度とフレームレートから算出。
export const BEAM_RAYCAST_WIDTH = 1.0 * MAZE_SCALE; // レイキャストの横方向の広がり
export const BEAM_RAYCAST_NUM_RAYS = 9;             // レイキャストを飛ばす本数 (奇数推奨: 中央1本 + 左右対称)
export const BEAM_RAYCAST_HEIGHT = 1.0 * MAZE_SCALE; // 垂直方向のレイキャストの広がり (敵の高さに合わせて調整)
export const BEAM_RAYCAST_NUM_RAYS_HORIZONTAL = 3;  // 水平方向のレイの本数
export const BEAM_RAYCAST_NUM_RAYS_VERTICAL = 3;    // 垂直方向のレイの本数
export const BEAM_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.5; // ビームをキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const KICK_BEAM_DELAY = 0.7; // キックアニメーション開始からビームが発射されるまでの遅延時間 (秒)。アニメーションと同期させるために調整。
export const MAX_BEAM_LIFETIME = 2000; // 3000でビームが3秒で消える (ミリ秒)

// --- 魔貫光殺砲風ビーム 設定 (Makanko Beam Settings) ---
export const MAKANKO_BEAM_TYPE_ENABLED = true;     // このビームタイプを使用するかどうか (true/false)
export const MAKANKO_CORE_BEAM_RADIUS = 0.08 * MAZE_SCALE;  // 中心ビームの半径
export const MAKANKO_CORE_BEAM_COLOR = 0xffff00;    // 中心ビームの色
export const MAKANKO_BEAM_LENGTH = BEAM_LENGTH * 0.8; // ビームの全長 (通常ビームの長さを基準にするか、専用の値)
export const MAKANKO_CORE_EMISSIVE_INTENSITY = 2.5; // 中心ビームの自己発光の強さ
export const MAKANKO_CORE_METALNESS = 0.1;          // 中心ビームの金属っぽさ
export const MAKANKO_CORE_ROUGHNESS = 0.7;          // 中心ビームの表面の粗さ

export const MAKANKO_SPIRAL_COLOR = 0xff441f;       // 螺旋の色
export const MAKANKO_NUM_SPIRAL_STRANDS = 4;        // 螺旋の筋の本数
export const MAKANKO_SPIRAL_TUBE_RADIUS = 0.05 * MAZE_SCALE; // 螺旋チューブ自体の半径（太さ）
export const MAKANKO_SPIRAL_TUBE_SEGMENTS = 48;     // 螺旋チューブのパスに沿った分割数（滑らかさ）
export const MAKANKO_SPIRAL_PATH_POINTS = 30;       // 螺旋パスを生成するための点の数
export const MAKANKO_SPIRAL_DISTANCE_FROM_CENTER = 1.7 * MAZE_SCALE; // 中心ビームからの螺旋の半径
export const MAKANKO_SPIRAL_PITCH = 1.3 * MAZE_SCALE; // 螺旋のピッチ（1回転で進む距離、小さいほど密）
export const MAKANKO_SPIRAL_ROTATION_SPEED_FACTOR = 30; // 螺旋の回転アニメーションの速度係数
export const MAKANKO_SPIRAL_EMISSIVE_INTENSITY = 1.5; // 螺旋チューブの自己発光の強さ
export const MAKANKO_SPIRAL_METALNESS = 0.05;       // 螺旋チューブの金属っぽさ
export const MAKANKO_SPIRAL_ROUGHNESS = 0.8;        // 螺旋チューブの表面の粗さ

export const MAKANKO_BEAM_SPEED = BEAM_SPEED * 1.0;  // ビームのスピード
export const MAKANKO_MAX_BEAM_LIFETIME = MAX_BEAM_LIFETIME * 1.0; // ビームの寿命



// --- リング 01 設定 ---
export const RING_01_ENABLED = true; // リングを表示するかどうか
export const RING_01_COLOR = 0x00ff7f; // リング1の色 (あざやかな緑)
export const RING_01_RADIUS = 0.4 * MAZE_SCALE; // リング1の全体の半径
export const RING_01_THICKNESS = 0.03 * MAZE_SCALE; // リング1の淵の太さ (チューブ部分の半径)
export const RING_01_DURATION = 1.0; // リング1の表示時間 (秒)
export const RING_01_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.2; // リング1をキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_01_SPAWN_OFFSET_UP = RING_01_RADIUS * 4.1;    // リング1をキャラクターの足元基準で、どれだけ上方向にオフセットしてスポーンさせるか。

// --- リング 02 設定 ---
export const RING_02_ENABLED = true;
export const RING_02_COLOR = 0x00ff7f; // リング2の色
export const RING_02_RADIUS = 0.38 * MAZE_SCALE; // リング2の全体の半径 
export const RING_02_THICKNESS = 0.02 * MAZE_SCALE; // リング2の淵の太さ
export const RING_02_DURATION = 1.1; // リング2の表示時間
export const RING_02_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 4.3; // リング2をキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_02_SPAWN_OFFSET_UP = RING_01_RADIUS * 4.1;   // リング2をキャラクターの足元基準で、どれだけ上方向にオフセットしてスポーンさせるか。
// --- リング 03 設定 ---
export const RING_03_ENABLED = true;
export const RING_03_COLOR = 0x00ff7f; // リング3の色
export const RING_03_RADIUS = 0.36 * MAZE_SCALE; // リング3の全体の半径
export const RING_03_THICKNESS = 0.01 * MAZE_SCALE; // リング3の淵の太さ
export const RING_03_DURATION = 1.2; // リング3の表示時間
export const RING_03_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 5.4; // リング3をキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_03_SPAWN_OFFSET_UP = RING_01_RADIUS * 4.1;   // リング3をキャラクターの足元基準で、どれだけ上方向にオフセットしてスポーンさせるか。


// --- ミニマップ設定 ---
export const MINIMAP_ENABLED = true; // ミニマップ表示の有効/無効フラグ。trueで表示、falseで非表示。
export const MINIMAP_SIZE_PX = 200; // ミニマップの表示サイズ (ピクセル)。
export const MINIMAP_MARGIN_PX = 10; // ミニマップの画面端からのマージン (ピクセル)。
export const MINIMAP_CAMERA_Y_OFFSET_FACTOR = 1.5; // ミニマップ用カメラのY軸オフセット係数。迷路のバウンディングボックスの高さに対する倍率などで使用される想定。値が大きいほど広範囲を映す。
export const MINIMAP_INDICATOR_Y_OFFSET = 50; // ミニマップ上のキャラクター位置インジケータのY軸オフセット（対象オブジェクトの上面からの高さ）。
export const MINIMAP_INDICATOR_SIZE = CHARACTER_RADIUS * 40; // ミニマップ上のキャラクター位置インジケータのサイズ。

// --- 物理演算関連 ---
export const GRAVITY = -10 * CHARACTER_INITIAL_SCALE * 2; // 物理エンジンで使用する重力加速度。キャラクターのスケールに合わせて調整されています。負の値で下向き。
export const CHARACTER_MASS = 40; // キャラクターの物理的な質量 (kg相当)。衝突時の挙動に影響します。
export const CHARACTER_FRICTION = 0.9; // キャラクターの物理的な摩擦係数 (0-1)。地面との滑りやすさに影響。大きいほど滑りにくい。
export const CHARACTER_RESTITUTION = 0.1; // キャラクターの物理的な反発係数 (0-1)。衝突時の跳ね返りやすさに影響。0で跳ね返らず、1で完全に跳ね返る。
export const WALL_FRICTION = 0.7; // 壁の物理的な摩擦係数。
export const WALL_RESTITUTION = 0.5; // 壁の物理的な反発係数。
// export const CHARACTER_AIR_CONTROL_FACTOR = 0.5; // 空中での移動制御の効き具合 (1で地上と同じ)


// --- 球体 (Sphere) 設定 ---
export const NUM_SPHERES = 25; // ゲーム内に生成する球体の数。
export const MIN_SPHERE_RADIUS = 2.5 * MAZE_SCALE; // 生成される球体の最小半径。
export const MAX_SPHERE_RADIUS = 3 * MAZE_SCALE; // 生成される球体の最大半径。
export const SPHERE_MASS = 20; // 球体の物理的な質量。
export const SPHERE_FRICTION = 0.4; // 球体の物理的な摩擦係数。
export const SPHERE_RESTITUTION = 0.6; // 球体の物理的な反発係数。
export const SPHERE_INITIAL_Y_OFFSET = 10 * MAZE_SCALE; // 球体の初期配置時のY軸オフセット（床面からの高さ）。埋まらないように調整。

// --- Ramiel (正八面体) 設定 ---
export const NUM_RAMIELS = 7; // ゲーム内に生成するラミエルの数。
export const RAMIEL_INITIAL_HP = 300; // ラミエルの初期HP
export const RAMIEL_SIZE = 7 * MAZE_SCALE; // 生成されるラミエルの基本サイズ (OctahedronGeometryの半径に相当)。
export const RAMIEL_CORE_RADIUS_FACTOR = 0.05; // ラミエルの中心核の半径（RAMIEL_SIZEに対する割合）。
export const RAMIEL_COLOR = 0x1e90ff; // ラミエルの基本色 (青)。
export const RAMIEL_CORE_COLOR = 0xff0000; // ラミエルの中心核の色 (赤)。
export const RAMIEL_OPACITY = 0.95; // ラミエルの透明度 (0.0 - 1.0)。
export const RAMIEL_METALNESS = 0.3; // ラミエルの金属っぽさ (0.0 - 1.0)。
export const RAMIEL_ROUGHNESS = 0.1; // ラミエルの表面の粗さ (0.0 - 1.0)。
export const RAMIEL_MASS = 20000; // ラミエルの物理的な質量。
export const RAMIEL_FRICTION = 1.0; // ラミエルの物理的な摩擦係数。
export const RAMIEL_RESTITUTION = 0.0001; // ラミエルの物理的な反発係数。
export const RAMIEL_INITIAL_Y_OFFSET = 3 * MAZE_SCALE; // ラミエルの初期配置時のY軸オフセット。

export const RAMIEL_HP_BAR_ENABLED = true; // HPバー表示の有効/無効
export const RAMIEL_HP_BAR_WIDTH = 4.5 * MAZE_SCALE;   // HPバーのワールド空間での幅
export const RAMIEL_HP_BAR_HEIGHT = 0.5 * MAZE_SCALE;  // HPバーのワールド空間での高さ
export const RAMIEL_HP_BAR_OFFSET_X = RAMIEL_SIZE * 0.0; // ラミエルローカルX軸オフセット (+で右)
export const RAMIEL_HP_BAR_OFFSET_Y = RAMIEL_SIZE * 1.1; // ラミエルローカルY軸オフセット (+で上)
export const RAMIEL_HP_BAR_OFFSET_Z = 0;                 // ラミエルローカルZ軸オフセット (通常0)

export const RAMIEL_HP_BAR_CANVAS_WIDTH = 256;  // HPバー描画用Canvasの幅 (px)
export const RAMIEL_HP_BAR_CANVAS_HEIGHT =64; // HPバー描画用Canvasの高さ (px)

export const RAMIEL_HP_BAR_BG_COLOR = 'rgba(40, 40, 40, 0.8)';       // HPバーの背景色 (枠線や空HP部分)
export const RAMIEL_HP_BAR_FG_COLOR_HIGH = 'rgba(0, 255, 0, 0.9)';   // HP高時のバーの色 (緑)
export const RAMIEL_HP_BAR_FG_COLOR_MID = 'rgba(255, 255, 0, 0.9)';    // HP中時のバーの色 (黄)
export const RAMIEL_HP_BAR_FG_COLOR_LOW = 'rgba(255, 0, 0, 0.9)';     // HP低時のバーの色 (赤)
export const RAMIEL_HP_BAR_BORDER_COLOR = 'rgba(0, 0, 0, 0.9)'; // HPバーの枠線の色
export const RAMIEL_HP_BAR_BORDER_WIDTH = 0.5; // HPバーの枠線の太さ (px)

export const RAMIEL_HP_BAR_TEXT_LABEL = "第五使徒"; // HPバーの上に表示するテキスト
export const RAMIEL_HP_BAR_TEXT_COLOR = 'rgba(255, 255, 255, 1.0)';  // テキストの色
export const RAMIEL_HP_BAR_FONT_SIZE = 42; // テキストのフォントサイズ (px)
export const RAMIEL_HP_BAR_FONT_FAMILY = 'Arial, sans-serif'; // テキストのフォントファミリー

// Canvas内でのレイアウト用 (px単位)
export const RAMIEL_HP_BAR_TEXT_AREA_HEIGHT = 48; // テキスト表示領域の高さ
export const RAMIEL_HP_BAR_PADDING_TOP_TEXT = 1;  // テキスト上部のパディング
export const RAMIEL_HP_BAR_PADDING_BOTTOM_TEXT = 1; // テキスト下部（バー上部との間）のパディング
export const RAMIEL_HP_BAR_ACTUAL_BAR_HEIGHT = RAMIEL_HP_BAR_CANVAS_HEIGHT - RAMIEL_HP_BAR_TEXT_AREA_HEIGHT - RAMIEL_HP_BAR_PADDING_TOP_TEXT - RAMIEL_HP_BAR_PADDING_BOTTOM_TEXT - RAMIEL_HP_BAR_BORDER_WIDTH * 2;
export const RAMIEL_HP_BAR_PADDING_HORIZONTAL = RAMIEL_HP_BAR_BORDER_WIDTH; // バーの左右パディング (枠線幅に合わせる)


// --- Ramiel (正八面体)  破壊時 十字架エフェクト設定 ---
export const RAMIEL_CROSS_EFFECT_ENABLED = true; // エフェクトの有効/無効
export const RAMIEL_CROSS_HEIGHT = 10 * MAZE_SCALE; // 十字架の高さ
export const RAMIEL_CROSS_ARM_LENGTH = 5 * MAZE_SCALE; // 十字架の横棒の全長
export const RAMIEL_CROSS_THICKNESS = 0.5 * MAZE_SCALE;   // 十字架の太さ（厚み）
export const RAMIEL_CROSS_COLOR = 0xff1f44;          // 十字架の色 (赤系の光)
export const RAMIEL_CROSS_OPACITY = 0.7;             // 十字架の透明度
export const RAMIEL_CROSS_EMISSIVE_INTENSITY = 5.0;  // 自己発光の強さ
export const RAMIEL_CROSS_DURATION = 0.7;            // 表示時間 (秒)
export const RAMIEL_CROSS_FADE_IN_DURATION = 0.2;   // フェードイン時間 (秒)
export const RAMIEL_CROSS_FADE_OUT_DURATION = 0.3;  // フェードアウト時間 (秒)
export const RAMIEL_CROSS_Y_OFFSET = RAMIEL_CROSS_HEIGHT / 2; // 地面からのオフセット（中心を地面に合わせるため）

// --- Ramiel 板型 ATフィールド風エフェクト設定 ---
export const RAMIEL_AT_FIELD_ENABLED = true;        // エフェクトの有効/無効
export const RAMIEL_AT_FIELD_COLOR = 0xffa500;    // エフェクトの色 (オレンジ)
export const RAMIEL_AT_FIELD_RADIUS = RAMIEL_SIZE * 1.5; // 正八角形の外接円の半径 (ラミエルのサイズに比例)
export const RAMIEL_AT_FIELD_INITIAL_OPACITY = 0.7; // 初期不透明度
export const RAMIEL_AT_FIELD_DURATION = 0.5;      // 表示時間 (秒)
export const RAMIEL_AT_FIELD_FADE_OUT_START_RATIO = 0.3; // 表示時間のうち、どの割合からフェードアウトを開始するか (0.0 - 1.0)
// 例: 0.3なら最初の30%は最大不透明度、残りの70%でフェードアウト          
// export const RAMIEL_AT_FIELD_THICKNESS = 0.1 * MAZE_SCALE; // (オプション) もし厚みを持たせる場合
export const RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL = RAMIEL_SIZE * 0.8 + RAMIEL_AT_FIELD_RADIUS * 0.3; // ラミエルの半径 + ATフィールドの半径の少し外側 (重なりを防ぐ)


// --- Ramiel 波紋 ATフィールド風エフェクト設定 ---
export const RAMIEL_AT_FIELD_IS_WAVE_EFFECT = true; // trueなら波紋、falseなら従来の単一板 (切り替え用)

export const RAMIEL_AT_FIELD_WAVE_NUM_RINGS = 5;         // 波紋を構成するリングの数
export const RAMIEL_AT_FIELD_WAVE_RING_DURATION = 0.6;  // 各リングの出現から消滅までの時間 (秒)
export const RAMIEL_AT_FIELD_WAVE_SPAWN_INTERVAL = 0.15; // 各リングが出現する時間間隔 (秒)
export const RAMIEL_AT_FIELD_WAVE_START_SCALE = 0.05;   // リングの初期スケール (RAMIEL_AT_FIELD_RADIUSに対する割合)
export const RAMIEL_AT_FIELD_WAVE_END_SCALE_FACTOR = 1.0; // リングの最終スケール (RAMIEL_AT_FIELD_RADIUSに対する割合)
// リングの「太さ」は、RingGeometryのinnerRadiusとouterRadiusの差で表現します。
// 最大スケール時の太さを基準にジオメトリを定義し、それを拡大縮小します。
export const RAMIEL_AT_FIELD_WAVE_RING_THICKNESS_RATIO = 0.1; // リングの外半径に対する太さの割合 (例: 0.1なら外半径の10%が太さ)
export const RAMIEL_AT_FIELD_WAVE_FADE_OUT_START_RATIO_PER_RING = 0.5; // 各リングの寿命のうち、どの割合からフェードアウトを開始するか


// --- 太陽と指向性光源の設定 ---
export const SUN_ENABLED = true; // 太陽オブジェクトを表示するかどうか
export const SUN_POSITION = new THREE.Vector3(1500 * MAZE_SCALE, 300 * MAZE_SCALE, -1800 * MAZE_SCALE); // 太陽の3Dオブジェクトの位置
export const SUN_SIZE = 100 * MAZE_SCALE; // 太陽の3Dオブジェクトの半径
export const SUN_COLOR = 0xffddaa; // 太陽の3Dオブジェクトの色 (例: ややオレンジがかった黄色)
export const SUN_EMISSIVE_INTENSITY = 1.5; // (オプション) MeshStandardMaterialで自己発光させる場合の強度

// 指向性光源 (太陽光) の設定 (既存の DirectionalLight をこちらで管理)
export const DIRECTIONAL_LIGHT_COLOR = 0xffffff; // 太陽光の色
export const DIRECTIONAL_LIGHT_INTENSITY = 2.0;  // 太陽光の強度 (既存の2.2から少し調整する例)
// DIRECTIONAL_LIGHT_POSITION は SUN_POSITION を使用します

export const DIRECTIONAL_LIGHT_CAST_SHADOW = true; // 影を生成するか
export const DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH = 4096; // シャドウマップの幅
export const DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT = 4096; // シャドウマップの高さ
export const DIRECTIONAL_LIGHT_SHADOW_BIAS = -0.001; // シャドウバイアス

// DirectionalLightのシャドウカメラの範囲。シーンの大きさと太陽の位置に応じて調整が必要
export const SHADOW_CAMERA_NEAR = 10;
export const SHADOW_CAMERA_FAR = 1000 * MAZE_SCALE; // 太陽の位置とシーン全体をカバーできるように調整
export const SHADOW_CAMERA_SIZE = 700 * MAZE_SCALE; // 影が描画される範囲の広さ。太陽の位置や角度で調整

// --- オーディオ設定 ---
// BGM
export const BGM_PATH = './audio/miku3.mp3';
export const BGM_VOLUME = 0.02;
export const BGM_LOOP = true;

// 効果音 (SFX) - ビーム
export const SFX_BEAM_PATH = './audio/beam_01.mp3';
export const SFX_BEAM_VOLUME = 0.04;
export const SFX_BEAM_LOOP = false; // 効果音は通常ループしない

// --- Enemy: Enemy_001 設定 ---
// export const ENEMY_001_NUM_INSTANCES = 1; // テスト用1体の初期配置数
export const ENEMY_001_MODEL_PATH = './models/test_Enemy_idol_20250527_01アニメ無し.fbx';
export const ENEMY_001_ANIMATIONS = {
    idle: './models/test_Enemy_idol_20250526_02骨のみ.fbx', // アイドルアニメーションはモデルファイル自体に含まれる
    run: './models/test_Enemy_run_20250526_03.fbx',
    attack: './models/test_Enemy_attack_20250526_02.fbx'
};
// export const ENEMY_001_INITIAL_POSITIONS = [
//    new THREE.Vector3(80, 1, -80) //  (x, y, z) - Yはキャラクター同様、地面からの高さを調整（テスト用1体の初期配置）
//];

export const ENEMY_001_SCALE = 1.0; // モデルの倍率
export const ENEMY_001_BASE_HEIGHT = 2.0; // モデルの基準身長
export const ENEMY_001_BASE_RADIUS = 0.5; // モデルの基準半径
export const ENEMY_001_HEIGHT = ENEMY_001_BASE_HEIGHT * ENEMY_001_SCALE;
export const ENEMY_001_RADIUS = ENEMY_001_BASE_RADIUS * ENEMY_001_SCALE;
export const ENEMY_001_MASS = 5000; // モデルの質量
export const ENEMY_001_FRICTION = 0.9; // モデルの摩擦係数 (0に近いとツルツル、1に近いとザラザラ)。
export const ENEMY_001_RESTITUTION = 0.1; // モデルの反発係数 (0で全く跳ね返らず、1で完全に跳ね返り)。
export const ENEMY_001_HP = 75;// 最大HP
export const ENEMY_001_ATTACK_DAMAGE = 5;// 攻撃力
export const ENEMY_001_LOCAL_FORWARD = new THREE.Vector3(0, 0, 1); // モデルの前方方向
export const ENEMY_001_MOVE_SPEED = 15.0; // 移動時の速度

// 停止と移動の固定値はやめてみる。
// export const ENEMY_001_IDLE_DURATION = 3.0; // 停止状態の持続時間 (秒)
// export const ENEMY_001_RUN_DURATION = 3.0;  // 移動状態の持続時間 (秒)

export const ENEMY_001_IDLE_DURATION_MIN = 1.0; // アイドル状態の最短持続時間 (秒)
export const ENEMY_001_IDLE_DURATION_MAX = 4.0; // アイドル状態の最長持続時間 (秒)

export const ENEMY_001_RUN_DURATION_MIN = 3.0;  // 移動状態の最短持続時間 (秒)
export const ENEMY_001_RUN_DURATION_MAX = 7.0;  // 移動状態の最長持続時間 (秒)

// 旋回に関する定数
export const ENEMY_001_TURN_CHANCE = 0.5;         // RUN状態に入る前に旋回する確率 (0.0 - 1.0)
export const ENEMY_001_TURN_SPEED = Math.PI;  // 旋回速度 (ラジアン/秒)

// ENEMY_001_TURN_SPEED = Math.PI / 2; (90度/秒) なら、約1秒で旋回完了。
// ENEMY_001_TURN_SPEED = Math.PI; (180度/秒) なら、約0.5秒で旋回完了。
// ENEMY_001_TURN_SPEED = Math.PI / 4; (45度/秒) なら、約2秒で旋回完了。

export const ENEMY_001_MAX_CONSECUTIVE_STRAIGHTS = 2; // 同じ方向に連続で直進できる最大回数



// --- Enemy_001 スポーン設定 (フェーズ1: 固定座標指定) ---
export const ENEMY_001_SPAWN_SETTINGS = {
    /**
     * 敵のスポーン方法を指定します。
     * 'FIXED': INITIAL_POSITIONS 配列に定義された固定座標を使用します。
     * (将来用) 'RANDOM_IN_AREA': 指定エリア内にランダムに配置します。
     * (将来用) 'FIXED_FROM_LIST_RANDOM': POSSIBLE_SPAWN_POINTS リストからランダムに選択して配置します。
     */
    METHOD: 'FIXED',

    /**
     * METHOD が 'FIXED' の場合に、実際に生成する敵のインスタンス数。
     * この数は INITIAL_POSITIONS 配列の要素数以下である必要があります。
     * もしこの値が INITIAL_POSITIONS.length より大きい場合、
     * EnemyManager は INITIAL_POSITIONS.length に合わせて調整します。
     */
    NUM_INSTANCES: 20, // 3体生成する場合は3

    /**
     * METHOD が 'FIXED' の場合に参照する、敵の初期位置の座標リスト。
     * new THREE.Vector3(x, y, z) 形式で指定します。
     * Y座標は、敵モデルの足元が地面に適切に接するよう調整してください。
     */
    INITIAL_POSITIONS: [
        new THREE.Vector3(20, 1, -20),   // 1体目の初期位置
        new THREE.Vector3(80, 1, -70),   // 2体目の初期位置
        new THREE.Vector3(120, 1, -140),   // 3体目の初期位置
        new THREE.Vector3(150, 1, -170),
        new THREE.Vector3(160, 1, -120),
        new THREE.Vector3(-30, 1, 30),
        new THREE.Vector3(-40, 1, 80),
        new THREE.Vector3(-130, 1, 50),
        new THREE.Vector3(-180, 1, 70),
        new THREE.Vector3(-180, 1, 130),

        new THREE.Vector3(25, 1, -25),
        new THREE.Vector3(85, 1, -75),
        new THREE.Vector3(125, 1, -145),
        new THREE.Vector3(155, 1, -175),
        new THREE.Vector3(165, 1, -125),
        new THREE.Vector3(-35, 1, 35),
        new THREE.Vector3(-45, 1, 85),
        new THREE.Vector3(-135, 1, 55),
        new THREE.Vector3(-185, 1, 75),
        new THREE.Vector3(-185, 1, 135),



        // new THREE.Vector3(100, 1, -60), // x体目以降
    ],

    // --- 以下は将来のランダムスポーン機能用の設定 ---
    /*
    RANDOM_COUNT: 5, // (将来用) ランダム生成する場合の敵の数
    SPAWN_AREA: {    // (将来用) ランダム生成する場合のエリア範囲
        MIN_X: -100, MAX_X: 100,
        MIN_Z: -100, MAX_Z: 100,
        Y_POSITION: 1, // (将来用) ランダム生成時の基準Y座標、またはレイキャストの基準
        Y_RAYCAST_OFFSET: 20,
        Y_TARGET_OFFSET_FROM_GROUND: 0.1,
    },
    CONSTRAINTS: {   // (将来用) ランダム生成時の制約条件
        MIN_DISTANCE_FROM_PLAYER_START: 30,
        MIN_DISTANCE_BETWEEN_ENEMIES: 8,
        MAX_ATTEMPTS_PER_ENEMY: 50,
    },
    POSSIBLE_SPAWN_POINTS: [ // (将来用) 安全なスポーン地点のリスト
        // new THREE.Vector3(x1, y1, z1),
    ]
    */
};

// --- Enemy 汎用波紋ATフィールド風エフェクト設定 ---
// 敵に適用される汎用波紋ATフィールドの設定
export const ENEMY_GENERIC_AT_FIELD_ENABLED = true; // 敵に波紋ATフィールドを適用するかどうか (true/false)
export const ENEMY_GENERIC_AT_FIELD_COLOR = 0xffa500; // 敵用エフェクトの色

// エフェクトのサイズと位置を敵モデルに合わせて調整するためのファクター
export const ENEMY_GENERIC_AT_FIELD_RADIUS_FACTOR = 1.5; // 敵の半径に対するエフェクトの半径の倍率
export const ENEMY_GENERIC_AT_FIELD_OFFSET_Y_FACTOR = 1.5; // 敵の高さに対するエフェクトのY軸オフセットの倍率 (0.5で中心、1.0で上端付近)
export const ENEMY_GENERIC_AT_FIELD_OFFSET_HORIZONTAL_FACTOR = 7.0; // 水平方向のオフセット係数ATフィールド半径に対する水平オフセットの倍率 (0.0で中心、1.0で端がモデルに接する)

// 波紋の数、速さ、見た目に関する設定 (ラミエルと似ているが、独立して調整可能)
export const ENEMY_GENERIC_AT_FIELD_NUM_RINGS = 5;         // 波紋を構成するリングの数
export const ENEMY_GENERIC_AT_FIELD_RING_DURATION = 0.5;  // 各リングの出現から消滅までの時間 (秒)
export const ENEMY_GENERIC_AT_FIELD_SPAWN_INTERVAL = 0.1; // 各リングが出現する時間間隔 (秒)
export const ENEMY_GENERIC_AT_FIELD_START_SCALE = 0.05;   // リングの初期スケール (最終半径に対する割合)
export const ENEMY_GENERIC_AT_FIELD_END_SCALE_FACTOR = 3.0; // リングの最終スケール (指定半径に対する倍率)
export const ENEMY_GENERIC_AT_FIELD_RING_THICKNESS_RATIO = 0.12; // リングの外半径に対する太さの割合
export const ENEMY_GENERIC_AT_FIELD_FADE_OUT_START_RATIO_PER_RING = 0.3; // 各リングの寿命のうち、どの割合からフェードアウトを開始するか
export const ENEMY_GENERIC_AT_FIELD_INITIAL_OPACITY = 0.7; // 初期不透明度
