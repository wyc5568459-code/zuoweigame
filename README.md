# zuoweigame（左为游戏）

一个可部署到 GitHub Pages 的纯前端小游戏仓库。

## 项目结构

```text
.
├── index.html              # 游戏总入口页
└── games/
    └── game1/
        ├── index.html      # 游戏 1：反应速度挑战
        ├── style.css
        └── script.js
```

## 本地游玩

无需安装依赖，直接在浏览器中打开以下文件即可：

- `index.html`：查看游戏列表
- `games/game1/index.html`：直接进入反应速度挑战

## 启用 GitHub Pages

1. 进入仓库 `Settings` -> `Pages`
2. `Build and deployment` 中选择：
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
3. 保存后等待 GitHub 完成发布

## 访问路径示例

发布后可通过类似路径访问：

- 首页：`/`
- 游戏 1：`/games/game1/`
