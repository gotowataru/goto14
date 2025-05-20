// constants.js

import * as THREE from 'three';

// --- モデル・アニメーション関連 ---
export const MAZE_MODEL_PATH = './models/debug_map08.glb'; // 迷路の3Dモデルファイルのパス。変更すると読み込まれる迷路が変わります。
export const CHARACTER_BASE_MODEL_PATH = './models/idol_20250519_01.fbx'; // キャラクターの基本（アイドル状態などのベース）モデルファイルのパス。idle.fbx　box　idol_20250519_2
export const ANIMATION_PATHS = { // キャラクターのアニメーションファイルパス。各動作のアニメーションを変更します。
    idle: './models/idol_20250519_01.fbx',    // アイドル状態のアニメーション
    run: './models/run_20250519_02.fbx',   // 走行状態のアニメーションtest_run1
    kick: './models/kick_20250519_02.fbx'  // キック動作のアニメーションkick_01
    //, jump: './models/jump_01.fbx' // ジャンプは削除済みなのでこのまま
};

// --- キャラクター基本設定 ---
export const CHARACTER_INITIAL_POSITION = new THREE.Vector3(0, 1, 0); // キャラクターの初期位置 (x, y, z)。ゲーム開始時のキャラクターのスポーン地点。一時的にコメントアウト

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
export const BEAM_RADIUS = 0.5 * MAZE_SCALE; // ビームの半径。ビームの太さを決定します。
export const BEAM_LENGTH = 500 * MAZE_SCALE; // ビームの視覚的な長さ。
export const BEAM_SPEED = 100 * MAZE_SCALE; // ビームの進行速度。
export const BEAM_RAYCAST_DISTANCE = BEAM_SPEED * (1.0 / 60.0) * 1.2; // ビームの1フレームあたりのレイキャスト（衝突判定）距離。貫通防止用。速度とフレームレートから算出。

export const RING_COLOR = 0x00ff7f; // キック時に発生するリングエフェクトの色 (例: あざやかな緑系の色 )。
export const RING_RADIUS = 2.0 * MAZE_SCALE; // リングエフェクトの半径。
export const RING_DURATION = 1.0; // リングエフェクトの表示時間 (秒)。
export const BEAM_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.5; // ビームをキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.0; // リングをキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_SPAWN_OFFSET_UP = RING_RADIUS * 1.0; // リングをキャラクターの足元基準で、どれだけ上方向にオフセットしてスポーンさせるか。
export const KICK_BEAM_DELAY = 0.7; // キックアニメーション開始からビームが発射されるまでの遅延時間 (秒)。アニメーションと同期させるために調整。
export const MAX_BEAM_LIFETIME = 3000; // ビームが3秒で消える (3000ミリ秒)


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
export const CHARACTER_FRICTION = 0.7; // キャラクターの物理的な摩擦係数 (0-1)。地面との滑りやすさに影響。大きいほど滑りにくい。現在0.5
export const CHARACTER_RESTITUTION = 0.1; // キャラクターの物理的な反発係数 (0-1)。衝突時の跳ね返りやすさに影響。0で跳ね返らず、1で完全に跳ね返る。
export const WALL_FRICTION = 0.7; // 壁の物理的な摩擦係数。現在0.5
export const WALL_RESTITUTION = 0.5; // 壁の物理的な反発係数。
// export const CHARACTER_AIR_CONTROL_FACTOR = 0.5; // 空中での移動制御の効き具合 (1で地上と同じ)


// --- 球体 (Sphere) 設定 ---
export const NUM_SPHERES = 30; // ゲーム内に生成する球体の数。
export const MIN_SPHERE_RADIUS = 2.5 * MAZE_SCALE; // 生成される球体の最小半径。
export const MAX_SPHERE_RADIUS = 10 * MAZE_SCALE; // 生成される球体の最大半径。
export const SPHERE_MASS = 20; // 球体の物理的な質量。
export const SPHERE_FRICTION = 0.4; // 球体の物理的な摩擦係数。
export const SPHERE_RESTITUTION = 0.6; // 球体の物理的な反発係数。
export const SPHERE_INITIAL_Y_OFFSET = 10 * MAZE_SCALE; // 球体の初期配置時のY軸オフセット（床面からの高さ）。埋まらないように調整。

// --- Ramiel (正八面体) 設定 ---
export const NUM_RAMIELS = 10; // ゲーム内に生成するラミエルの数。
export const RAMIEL_SIZE = 8 * MAZE_SCALE; // 生成されるラミエルの基本サイズ (OctahedronGeometryの半径に相当)。
export const RAMIEL_CORE_RADIUS_FACTOR = 0.05; // ラミエルの中心核の半径（RAMIEL_SIZEに対する割合）。
export const RAMIEL_COLOR = 0x1e90ff; // ラミエルの基本色 (青)。
export const RAMIEL_CORE_COLOR = 0xff0000; // ラミエルの中心核の色 (赤)。
export const RAMIEL_OPACITY = 0.95; // ラミエルの透明度 (0.0 - 1.0)。
export const RAMIEL_METALNESS = 0.3; // ラミエルの金属っぽさ (0.0 - 1.0)。
export const RAMIEL_ROUGHNESS = 0.1; // ラミエルの表面の粗さ (0.0 - 1.0)。
export const RAMIEL_MASS = 20000; // ラミエルの物理的な質量。
export const RAMIEL_FRICTION = 1.0; // ラミエルの物理的な摩擦係数。
export const RAMIEL_RESTITUTION = 0.0001; // ラミエルの物理的な反発係数。
export const RAMIEL_INITIAL_Y_OFFSET = 10 * MAZE_SCALE; // ラミエルの初期配置時のY軸オフセット。

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
export const BGM_PATH = './audio/mikumiku.mp3';
export const BGM_VOLUME = 0.02;
export const BGM_LOOP = true;

// 効果音 (SFX) - ビーム
export const SFX_BEAM_PATH = './audio/beam_01.mp3';
export const SFX_BEAM_VOLUME = 0.04;
export const SFX_BEAM_LOOP = false; // 効果音は通常ループしない