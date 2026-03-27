# greatTangGemini

一个可直接访问的静态网页项目，用 3D 形式展示唐代诗人与作品。

在线访问：

- GitHub Pages: [https://god2father.github.io/greatTangGemini/](https://god2father.github.io/greatTangGemini/)

仓库地址：

- GitHub: [https://github.com/god2father/greatTangGemini](https://github.com/god2father/greatTangGemini)

## 项目内容

这个项目目前是一个纯前端静态站点，不需要安装依赖，也不需要构建。

打开后可以看到：

- 一条 3D 风格的时间长河
- 可交互的诗人节点
- 诗人生平信息面板
- 代表作品展示区域

## 本地打开

推荐直接用本地静态服务打开项目目录，不要双击 `index.html`。

例如在项目目录里运行：

```powershell
python -m SimpleHTTPServer 8000
```

然后访问：

```text
http://127.0.0.1:8000/
```

## 目录说明

- `index.html`：页面入口
- `css/`：页面样式和字体声明
- `js/`：页面交互、场景逻辑、数据
- `fonts/`：本地字体文件
- `lib/three/`：项目使用的 Three.js 本地库文件

## 部署方式

当前项目已经通过 GitHub Pages 发布，直接使用仓库中的 `main` 分支内容对外提供访问。

线上地址：

- [https://god2father.github.io/greatTangGemini/](https://god2father.github.io/greatTangGemini/)
