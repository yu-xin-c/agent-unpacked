# agent-unpacked

> 来自于 **Stellar鱼** 的 Agent 源码拆解教程。

一个面向初学者的交互式学习网站，以源码证据为主线，逐层拆解 DeepSeek Harness、PI Agent 与 nanobot：消息如何进入系统、上下文怎样组装、模型如何调用工具、状态怎样留下，以及这些能力最终如何组成完整产品。

## 在线阅读

- 腾讯云部署：[http://129.204.115.229/agent-unpacked/](http://129.204.115.229/agent-unpacked/)
- 示例课程：[D02 · Profile × Bundle](http://129.204.115.229/agent-unpacked/#/dsh/D02)

## 教程内容

- **拆 DSH**：插件内核、会话即真源、轮次边界、能力替换、上下文持续与产品组装。
- **拆 PI Agent**：分层骨架、模型事件流、Agent Loop、工具控制、会话树与扩展机制。
- **拆 nanobot**：消息总线、执行循环、上下文、模型与工具、记忆和产品边界。
- **横向对照**：使用统一问题比较三套 Agent 架构的设计取舍。

全站包含 24 节课程。每节课程都提供：

1. 面向小白的问题解释和生活类比；
2. 关键术语的通俗说明；
3. 可播放、暂停、点击和重播的运行流程动画；
4. 教学示意代码与阅读顺序；
5. 可跳转到官方仓库的代码证据；
6. 架构定位、常见误区、动手练习和自测答案。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm test
```

静态产物生成在 `out/`，默认使用 `/agent-unpacked` 作为部署子路径。

## 参考项目

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- [badlogic/pi-mono](https://github.com/badlogic/pi-mono)
- [HKUDS/nanobot](https://github.com/HKUDS/nanobot)

## 作者

教程策划与整理：**Stellar鱼**。

本项目用于源码学习与架构研究。相关项目的源码与商标归各自作者和组织所有。
