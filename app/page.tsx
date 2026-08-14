"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectKey = "dsh" | "pi" | "nanobot";
type RouteKey = "home" | ProjectKey | "compare";

type Lesson = {
  id: string;
  group: string;
  groupColor: string;
  title: string;
  kicker: string;
  motto: string;
  why: string;
  model: string;
  flow: string[];
  files: string[];
  code: string;
  points: string[];
  takeaway: string;
};

const nanobotLessons: Lesson[] = [
  {
    id: "N01",
    group: "消息地基",
    groupColor: "#4f8df7",
    title: "消息总线：先把入口与大脑拆开",
    kicker: "Inbound / Outbound",
    motto: "聊天入口只负责翻译消息，Agent 不需要知道消息来自飞书还是终端。",
    why: "如果每个聊天渠道都直接调用 Agent，路由、并发和回复投递会缠在一起。nanobot 用异步 MessageBus 把渠道层和推理核心隔开。",
    model: "把 MessageBus 想成机场塔台：Channel 把不同航空公司的请求翻译成同一种航班格式，核心只处理统一事件。",
    flow: ["Channel", "InboundMessage", "MessageBus", "AgentLoop", "OutboundMessage"],
    files: ["nanobot/bus/events.py", "nanobot/bus/queue.py", "nanobot/channels/base.py"],
    code: `await bus.publish_inbound(message)\n\nmessage = await bus.consume_inbound()\nresponse = await agent.process(message)\n\nawait bus.publish_outbound(response)`,
    points: ["统一消息词汇", "异步队列解耦", "渠道可独立扩展"],
    takeaway: "先统一事件，再谈智能。消息总线是 nanobot 从 CLI 长成多渠道产品的第一层。",
  },
  {
    id: "N02",
    group: "消息地基",
    groupColor: "#4f8df7",
    title: "AgentLoop × AgentRunner：一轮对话的两半",
    kicker: "Orchestration / Execution",
    motto: "Loop 管一次用户轮次，Runner 管一次模型—工具循环。",
    why: "渠道路由、会话键、工作区和回复投递属于产品层；模型重试、流式输出、工具调用属于执行层。拆开后，同一 Runner 才能被 CLI、WebUI 和 SDK 复用。",
    model: "AgentLoop 是制片人，决定演员、场地和档期；AgentRunner 是片场导演，只关心这一场戏怎么拍完。",
    flow: ["AgentLoop", "ContextBuilder", "AgentRunner", "Provider", "Tools", "Final"],
    files: ["nanobot/agent/loop.py", "nanobot/agent/runner.py", "nanobot/agent/hook.py"],
    code: `spec = AgentRunSpec(\n  initial_messages=messages,\n  tools=registry,\n  runtime=runtime,\n  max_iterations=limit,\n)\nresult = await runner.run(spec)`,
    points: ["产品编排与执行解耦", "共享 AgentRunSpec", "迭代上限与失败收口"],
    takeaway: "排查路由与会话，从 loop.py 开始；排查模型与工具，从 runner.py 开始。",
  },
  {
    id: "N03",
    group: "上下文装配",
    groupColor: "#25ad7c",
    title: "ContextBuilder：模型看到的世界如何被拼出来",
    kicker: "Prompt Assembly",
    motto: "上下文不是一段 system prompt，而是项目、人格、记忆与技能的受控合流。",
    why: "个人 Agent 同时拥有自己的身份和记忆，也要在当前项目里遵守 AGENTS.md 与工作区边界。ContextBuilder 负责把这些来源排序、裁剪并标记。",
    model: "像给潜水员打包装备：氧气、地图、任务卡都要带，但每件东西有自己的来源与安全边界。",
    flow: ["SOUL / USER", "Project AGENTS", "Memory", "Skills", "Runtime Context", "Messages"],
    files: ["nanobot/agent/context.py", "nanobot/runtime_context.py", "nanobot/utils/workspace_prompts.py"],
    code: `context = await builder.build(\n  session=session,\n  workspace=project,\n  tools=tool_registry,\n)\nmessages = context.to_messages()`,
    points: ["来源分层", "工作区边界", "按需技能注入"],
    takeaway: "Agent 的个性与项目规则不是一锅粥；清晰的上下文归属能避免权限和记忆串线。",
  },
  {
    id: "N04",
    group: "模型与工具",
    groupColor: "#a85ce5",
    title: "Provider：把模型差异压到一条窄缝里",
    kicker: "LLM Abstraction",
    motto: "AgentRunner 说统一语言，Provider 负责翻译各家模型协议。",
    why: "OpenAI-compatible、Anthropic、Azure、Bedrock、Codex 等协议在流式、推理块和工具调用上并不完全相同。统一 Provider 接口把差异挡在核心循环之外。",
    model: "国际插座转换器：墙里电压和插头不同，但设备只看到稳定的输出。",
    flow: ["Model Preset", "Provider Registry", "LLMRuntime", "stream()", "LLMResponse"],
    files: ["nanobot/providers/base.py", "nanobot/providers/registry.py", "nanobot/agent/model_runtime.py"],
    code: `response = await runtime.stream(\n  messages=messages,\n  tools=tools.schemas(),\n  call_context=provider_context,\n)`,
    points: ["统一响应词汇", "流式推理适配", "fallback model"],
    takeaway: "换模型不该改 Agent Loop；真正稳定的扩展点是一份小而清楚的协议。",
  },
  {
    id: "N05",
    group: "模型与工具",
    groupColor: "#a85ce5",
    title: "工具注册表：能力如何进入循环",
    kicker: "Schema / Execute",
    motto: "工具是模型能看懂的 schema，也是运行时能执行的 handler。",
    why: "文件、Shell、Web、Cron、MCP 都需要同一套发现、校验和错误语义。注册表让 Runner 不必为每个工具增加 if 分支。",
    model: "餐厅菜单 + 后厨工位：菜单告诉模型能点什么，注册表把订单送到真正的执行者。",
    flow: ["Discovery", "ToolRegistry", "JSON Schema", "Tool Call", "Handler", "Tool Result"],
    files: ["nanobot/agent/tools/registry.py", "nanobot/agent/tools/base.py", "nanobot/agent/tools/mcp.py"],
    code: `tool = tools.get(call.name)\nargs = tool.validate(call.arguments)\nresult = await tool.execute(**args)\nmessages.append(tool_result(result))`,
    points: ["插件式发现", "参数校验", "MCP 汇入同一注册表"],
    takeaway: "工具名、schema 和错误文本都是模型契约的一部分，改它们就等于改 API。",
  },
  {
    id: "N06",
    group: "持续上下文",
    groupColor: "#e69f2d",
    title: "Session 与 Compaction：对话如何活得更久",
    kicker: "History / Budget",
    motto: "Session 保存近场事实，Compaction 为下一轮腾出可用的 token 空间。",
    why: "长对话会超过模型上下文；直接截断又会丢目标与工具结果。nanobot 用会话历史、可见性规则和自动压缩共同治理上下文预算。",
    model: "书桌与档案盒：眼前只留正在用的材料，旧资料被整理成摘要，但仍有出处。",
    flow: ["Session JSONL", "Visibility", "Token Estimate", "Auto Compact", "Summary", "Next Turn"],
    files: ["nanobot/session/manager.py", "nanobot/agent/autocompact.py", "nanobot/agent/context_governance.py"],
    code: `if estimated_tokens > budget:\n    summary = await compact(history)\n    session.append(summary_event(summary))\n    messages = visible_history(session)`,
    points: ["持久会话", "上下文预算", "压缩后继续运行"],
    takeaway: "上下文治理不是删聊天记录，而是控制哪些历史在此刻进入模型。",
  },
  {
    id: "N07",
    group: "持续上下文",
    groupColor: "#e69f2d",
    title: "Memory × Dream：从聊天记录到长期知识",
    kicker: "Consolidation",
    motto: "历史回答‘刚才发生了什么’，记忆回答‘关于你，什么值得长期保留’。",
    why: "把完整历史塞进每轮既昂贵又嘈杂。Dream 在后台把反复出现的偏好、事实和流程沉淀到长期记忆，必要时还能提升成工作区技能。",
    model: "睡眠中的记忆巩固：白天的经历很多，夜里只把稳定模式写进长期记忆。",
    flow: ["Session History", "Dream", "MEMORY.md", "SOUL / USER", "Workspace Skills", "Future Context"],
    files: ["nanobot/agent/memory.py", "nanobot/templates/SOUL.md", "nanobot/templates/USER.md"],
    code: `candidates = await dream.review(history)\nawait memory.merge(candidates.facts)\nawait skills.promote(candidates.workflows)`,
    points: ["近场与远场分离", "后台巩固", "可检查的 Markdown 记忆"],
    takeaway: "好的长期记忆不是更多文本，而是更少、更稳定、可追溯的知识。",
  },
  {
    id: "N08",
    group: "产品边界",
    groupColor: "#e45f70",
    title: "Gateway：把内核组装成长期运行的产品",
    kicker: "Channels / WebUI / API",
    motto: "同一套 Agent runtime，从终端、WebSocket、聊天应用和 SDK 进入。",
    why: "生产中的个人 Agent 需要渠道生命周期、WebUI、API、Cron、配对与访问控制。Gateway 是组合根：创建并关闭这些基础设施，而不是把它们塞进 AgentLoop。",
    model: "一座车站：轨道是 Agent runtime，Gateway 负责站台、售票、时刻表和安全门。",
    flow: ["nanobot gateway", "Channel Manager", "WebSocket", "Cron / Dream", "AgentLoop", "Delivery"],
    files: ["nanobot/cli/gateway.py", "nanobot/channels/manager.py", "nanobot/api/server.py"],
    code: `async with gateway_services(config) as services:\n    await services.channels.start()\n    await services.agent_loop.run()`,
    points: ["应用拥有基础设施", "统一运行时多入口", "显式启动与关闭"],
    takeaway: "轻量不等于把一切写进一个文件，而是让每层只拥有自己该负责的生命周期。",
  },
];

const dshLessons: Lesson[] = [
  {
    id: "D01",
    group: "插件内核",
    groupColor: "#4f8df7",
    title: "Cordis：一切皆插件",
    kicker: "Context / Effect",
    motto: "没有特权核心；服务、事件和副作用都由插件贡献，也都能被撤回。",
    why: "传统 Agent 框架常靠修改中心类扩展能力。DSH 把模型、工具、会话甚至 Agent Loop 都放进插件树，让替换和组合成为默认动作。",
    model: "不是给一台整机焊接零件，而是在同一块背板上插拔模块；拔掉插件时，它注册的一切也一起回退。",
    flow: ["Plugin", "ctx", "Service", "Typed Events", "Effect Scope", "Dispose"],
    files: ["vendor/cordis", "docs/cordis-primer.zh.md", "packages/core/agent"],
    code: `ctx.plugin(myPlugin, config)\n\nctx.provide("capability", provider)\nctx.on("domain/event", listener)\nctx.effect(() => () => cleanup())`,
    points: ["共享 ctx", "类型化事件", "可逆副作用"],
    takeaway: "DSH 的扩展单位不是一个大类，而是一段可挂载、可隔离、可卸载的插件行为。",
  },
  {
    id: "D02",
    group: "插件内核",
    groupColor: "#4f8df7",
    title: "Profile × Bundle：产品就是一棵插件树",
    kicker: "Composition",
    motto: "先叠组合包，再叠用户 patch；运行时产品由配置顺序决定。",
    why: "Web、Headless、Minimal 等产品形态共享大量能力，但入口与策略不同。Bundle 分发一组插件，Profile 决定组合顺序，patch 能按 id 替换其中任何节点。",
    model: "像透明胶片叠图：base 是底稿，web-app 加 UI，用户 patch 在最上层覆盖局部。",
    flow: ["Empty", "dsh-base", "web / headless", "Profile Patch", "Home Patch", "--patch"],
    files: ["packages/bundle/base", "packages/bundle/web-app", "packages/boot/app-boot"],
    code: `dsh --profile web --dump-config\n\n# 每个条目都可由 id 定位并整体替换\n# profile → bundle[] → cordis.patch.yml`,
    points: ["有序层叠", "配置可检查", "任意节点可替换"],
    takeaway: "在 DSH 里，‘产品’不是一个入口文件，而是一棵最终可打印出来的配置树。",
  },
  {
    id: "D03",
    group: "会话即真源",
    groupColor: "#25ad7c",
    title: "SessionEvent：只追加，不覆盖",
    kicker: "Event Sourcing",
    motto: "不保存一份可变 messages；保存发生过的事实，再投影出模型历史。",
    why: "回放、fork、恢复、UI 与遥测若各自维护状态，很快会相互矛盾。DSH 把持久 SessionEvent 日志作为唯一真源。",
    model: "银行流水从不改旧账，只追加新交易；余额是流水的投影，不是另一份独立事实。",
    flow: ["user/message", "assistant/chunk", "assistant/message", "tool/call", "tool/result", "deriveMessages()"],
    files: ["packages/core/session", "docs/subsystems/session.md", "packages/client/ui-trajectory"],
    code: `session.append({ type: "user/message", ... })\n\nconst messages = deriveMessages(session.events)\n// UI、fork、transcript 同样消费事件流`,
    points: ["模型可见即已记录", "UI 保真回放", "fork 来自同一日志"],
    takeaway: "messages 是视图，不是存储。这个选择把可追溯性放在架构地基，而不是事后补日志。",
  },
  {
    id: "D04",
    group: "轮次边界",
    groupColor: "#a85ce5",
    title: "Turn / Step：一次对话到底何时结束",
    kicker: "Lifecycle",
    motto: "Step 是一次模型请求及其工具；Turn 是直到不再欠工作的一组 Step。",
    why: "工具结果、注入消息和续跑请求都会让 Agent 继续工作。DSH 用明确的 turn/step 生命周期，让 UI、日志和插件知道每个扩展点发生在哪一刻。",
    model: "Turn 是一张工单，Step 是工单里的操作记录；做完一次操作不代表工单已经关闭。",
    flow: ["turn/start", "claim input", "step/start", "LLM + tools", "step/end", "turn-stopping", "turn/end"],
    files: ["packages/core/agent-loop", "packages/core/agent", "docs/agent-lifecycle.zh.md"],
    code: `turn/start\n  agent/pre-step\n  step/start\n    agent/request → llm/stream\n    tool/call* → tool/result*\n  step/end\nturn/end`,
    points: ["轮次可观察", "输入 inbox", "插件化 stopping"],
    takeaway: "清楚的生命周期比一个神秘 while 循环更容易插入权限、续跑、UI 和遥测。",
  },
  {
    id: "D05",
    group: "轮次边界",
    groupColor: "#a85ce5",
    title: "工具执行管线：策略不住在工具里",
    kicker: "pre → execute → post",
    motto: "工具定义能力，管线承载审批、沙箱、超时和结果处理。",
    why: "如果每个工具自己实现权限与超时，策略会重复且难以统一。DSH 把工具调用暴露成 waterfall 事件，策略插件可以在执行前后插入。",
    model: "机场安检线：乘客各不相同，但证件、安检、登机的关卡是统一流水线。",
    flow: ["Tool Call", "tools/pre-execute", "Guard", "tools/execute", "Provider", "tools/post-execute", "Result"],
    files: ["packages/core/tools", "packages/guard", "docs/tool-execution-pipeline.zh.md"],
    code: `pre-execute(call)\n  → approval / timeout / policy\n  → execute(provider)\n  → post-execute(result)\n  → append tool/result`,
    points: ["横切策略", "waterfall 委托", "执行后统一收口"],
    takeaway: "工具越多，越应该让策略围绕调用管线复用，而不是复制进每个 handler。",
  },
  {
    id: "D06",
    group: "能力替换",
    groupColor: "#e69f2d",
    title: "Seam × Scope：能力如何被替换与隔离",
    kicker: "Definition / Provider / Consumer",
    motto: "一个 seam 由接口、实现者和使用者组成；scope 决定谁看见哪一个实现。",
    why: "本地文件系统、远程沙箱、不同 LLM 与不同 subagent 都需要在同一消费方背后互换。作用域允许单个 agent shadow 同名能力，而不污染全局。",
    model: "墙上的标准插座是 definition，电网是 provider，电器是 consumer；scope 则像不同房间的独立配电。",
    flow: ["Service Definition", "Scoped Registry", "Local Provider", "Remote Provider", "Consumer Tool"],
    files: ["packages/core/scope", "packages/fs/fs", "packages/subprocess/subprocess"],
    code: `ctx.fs = remoteFsProvider\nctx.subprocess = remoteProcessProvider\n\n// 同一 bash / editor / LSP consumer\n// 自动进入同一个远程执行世界`,
    points: ["接口不等于 seam 全部", "最具体 scope 获胜", "替换 provider 改变整块能力"],
    takeaway: "真正可组合的能力必须同时设计接口、实现和消费路径，不能只抽一个 TypeScript interface。",
  },
  {
    id: "D07",
    group: "上下文持续",
    groupColor: "#e45f70",
    title: "Compaction / Jobs / Goal：可选能力不进主循环",
    kicker: "Optional Domains",
    motto: "压缩、后台任务和目标续跑各自有独立领域，只通过事件与 seam 接入。",
    why: "把所有高级能力硬编码进 Agent Loop 会让内核不断膨胀。DSH 让它们分别管理状态与生命周期，通过标准扩展点重新把事实交回 Agent。",
    model: "主循环像城市道路；压缩、后台任务和目标系统是独立公共设施，通过标准路口接入，而不是铺进路面。",
    flow: ["Session / Agent", "Compaction", "Jobs", "Goal State", "Inject / Continue", "Next Step"],
    files: ["packages/compaction", "packages/jobs", "packages/workflow"],
    code: `job completes → agent.inject(fact)\ngoal active → request next round\ncompaction → append replace event\n\n// loop 只消费统一输入与事件`,
    points: ["领域独立", "事实重新注入", "主循环保持薄"],
    takeaway: "高级功能之所以可选，是因为它们不要求 Agent Loop 理解自己的内部状态。",
  },
  {
    id: "D08",
    group: "组装成产品",
    groupColor: "#14a7a0",
    title: "Web / Headless / Trajectory：同一内核的多种表面",
    kicker: "Product Surfaces",
    motto: "UI 驱动 Agent、渲染事件；Headless 驱动同一服务，却完全不需要服务器。",
    why: "编码 Agent 既要浏览器交互，也要一次性自动化和基准测试。Profile 只组装需要的表面，Trajectory 则直接从 SessionEvent 重建过程。",
    model: "同一台发动机可以装进不同车身；仪表盘读取的也是发动机真实事件，而不是另造一套状态。",
    flow: ["Profile", "Agents Service", "Session Events", "Web UI / Trajectory", "Headless Runner", "Result"],
    files: ["packages/bundle/web-app", "packages/bundle/headless", "packages/client/ui-trajectory"],
    code: `dsh web\ndsh --profile headless run "task"\n\n// 两种表面共享 session、tools、llm、agent-loop`,
    points: ["多产品表面", "事件驱动 UI", "无服务器 headless"],
    takeaway: "DSH 最值得学的不是功能数量，而是产品表面与内核机制之间保持了干净边界。",
  },
];

const piLessons: Lesson[] = [
  {
    id: "P01",
    group: "四层骨架",
    groupColor: "#ef684c",
    title: "Monorepo：从协议到终端的四层切片",
    kicker: "AI / Agent / Product / TUI",
    motto: "pi 不是一个大 CLI，而是 AI 协议、Agent 内核、Coding 产品和终端 UI 的逐层组装。",
    why: "如果模型适配、工具循环、会话功能和终端渲染都挤在一起，任何一层都难以单独复用。pi-mono 把它们拆成独立包，让最小 Agent core 能脱离 TUI 运行，Coding Agent 也能通过 SDK 嵌入别的产品。",
    model: "像一台四层唱机：pi-ai 读唱片协议，pi-agent-core 驱动转盘，coding-agent 组织播放列表，pi-tui 才是你看到的面板。",
    flow: ["pi-ai", "pi-agent-core", "pi-coding-agent", "pi-tui", "CLI / SDK / RPC"],
    files: ["packages/ai/src", "packages/agent/src", "packages/coding-agent/src/core"],
    code: `pi-ai            // providers + streaming vocabulary\npi-agent-core    // stateful loop + tools + events\npi-coding-agent // sessions + resources + product policy\npi-tui           // terminal rendering + input`,
    points: ["协议层可独立使用", "Agent core 不依赖 TUI", "产品能力向外组装"],
    takeaway: "读 pi 时不要从 CLI 一路钻到底；先认清四层包边界，再追一次输入穿过它们的路径。",
  },
  {
    id: "P02",
    group: "四层骨架",
    groupColor: "#ef684c",
    title: "pi-ai：把多家模型压成统一流",
    kicker: "Provider / Stream",
    motto: "核心循环只消费统一的 Message、ToolCall 与事件流，协议差异留在 provider 层。",
    why: "不同模型的认证、思考块、缓存、工具调用和流式事件各有差异。pi-ai 提供标准模型目录与 stream 函数，让上层 Agent 不需要知道当前是 Anthropic、OpenAI、Gemini 还是本地路由。",
    model: "像字幕组：各家模型说不同方言，pi-ai 把它们实时翻译成同一种字幕时间轴。",
    flow: ["Model Registry", "Provider", "streamSimple()", "Assistant Events", "Usage / Stop Reason"],
    files: ["packages/ai/src/types.ts", "packages/ai/src/providers", "packages/agent/src/stream-fn.ts"],
    code: `const model = models.getModel(provider, modelId)\n\nconst stream = models.streamSimple(\n  model, llmContext, options\n)\n\nfor await (const event of stream) emit(event)`,
    points: ["模型目录统一", "流事件统一", "token 与成本统一"],
    takeaway: "pi 的多模型能力不是在 Agent Loop 里写分支，而是让所有 provider 输出同一种可流式消费的词汇。",
  },
  {
    id: "P03",
    group: "Agent 内核",
    groupColor: "#4f8df7",
    title: "Agent Loop：状态机如何反复调用工具",
    kicker: "Prompt / Turn / Tool",
    motto: "一个 turn 等于一次模型响应及其工具执行；只要模型继续调工具，Agent run 就继续。",
    why: "最小循环不仅要把工具结果塞回模型，还要处理流式消息、取消、错误、并行工具和排队输入。pi-agent-core 把这段机制封装成可订阅的有状态 Agent。",
    model: "Agent 是一台事件驱动的洗衣机：每个阶段都会亮灯，工具调用是中途追加的洗涤步骤，直到程序明确结束。",
    flow: ["agent_start", "turn_start", "LLM Stream", "Tool Calls", "Tool Results", "turn_end", "agent_end"],
    files: ["packages/agent/src/agent.ts", "packages/agent/src/agent-loop.ts", "packages/agent/src/types.ts"],
    code: `await agent.prompt(userMessage)\n\nagent_start → turn_start\n  assistant stream\n  tool_execution*\n  tool results\nturn_end → next turn? → agent_end`,
    points: ["完整生命周期事件", "可取消的运行", "工具后自动续轮"],
    takeaway: "pi-agent-core 的关键产品不是一个 while，而是一套外部 UI、会话层和扩展都能可靠观察的生命周期。",
  },
  {
    id: "P04",
    group: "Agent 内核",
    groupColor: "#4f8df7",
    title: "双重转换：AgentMessage 如何进入模型",
    kicker: "transformContext / convertToLlm",
    motto: "应用可以保存丰富消息，但模型只看到被治理、被转换后的 LLM Message。",
    why: "终端执行记录、自定义扩展消息、压缩摘要等产品消息并不都能直接发给模型。pi 先用 transformContext 裁剪或注入上下文，再用 convertToLlm 过滤和转换消息类型。",
    model: "像电影剪辑：素材库保留所有机位，粗剪决定这场戏用哪些片段，最终转码才生成影院能播放的格式。",
    flow: ["AgentMessage[]", "transformContext()", "Context Budget", "convertToLlm()", "Message[]", "Provider"],
    files: ["packages/agent/src/types.ts", "packages/agent/src/agent-loop.ts", "packages/coding-agent/src/core/messages.ts"],
    code: `const transformed = await transformContext(messages)\nconst llmMessages = await convertToLlm(transformed)\n\n// UI-only/custom messages can stay persisted\n// without leaking into the provider request`,
    points: ["应用消息可扩展", "上下文治理独立", "模型协议保持窄"],
    takeaway: "‘保存什么’和‘模型看到什么’是两个问题；pi 用两道显式转换把它们分开。",
  },
  {
    id: "P05",
    group: "工具与控制",
    groupColor: "#a85ce5",
    title: "工具执行：并行、顺序与前后钩子",
    kicker: "Preflight / Execute / Finalize",
    motto: "先逐个预检，再按策略执行，最后仍按模型原始顺序写回结果。",
    why: "多个工具可以并发提速，但权限判断必须稳定，写操作也可能要求顺序。pi 支持全局与单工具 executionMode，并提供 beforeToolCall / afterToolCall 控制阻断、审计和提前终止。",
    model: "像厨房出单：先逐张确认过敏与库存，可并行的菜同时做，但上桌仍按订单顺序整理。",
    flow: ["Tool Calls", "Validate", "beforeToolCall", "Parallel / Sequential", "afterToolCall", "Ordered Results"],
    files: ["packages/agent/src/agent-loop.ts", "packages/agent/src/types.ts", "packages/coding-agent/src/core/tools"],
    code: `beforeToolCall(call) → block | allow\nexecuteMode = tool.sequential ? "sequential" : "parallel"\nresult = await tool.execute(...)\nafterToolCall(call, result) → override | terminate`,
    points: ["预检与执行分开", "批量并行", "结果顺序确定"],
    takeaway: "并发不应破坏可预测性；pi 把完成顺序和持久化顺序刻意区分开。",
  },
  {
    id: "P06",
    group: "会话交互",
    groupColor: "#25ad7c",
    title: "AgentSession：把内核变成可操控产品",
    kicker: "Steering / Follow-up",
    motto: "Agent 负责运行，AgentSession 负责模型、资源、队列、压缩和产品事件。",
    why: "用户会在 Agent 工作时继续输入。pi 把消息分成 steering 与 follow-up：前者在当前工具批次后介入，后者等 Agent 完成全部工作再送达。Session 同时协调模型切换、资源加载和持久化。",
    model: "像给正在导航的司机说话：steering 是‘前面改走左边’，follow-up 是‘到达后再去加油站’。",
    flow: ["User Input", "AgentSession", "Steering Queue", "Agent", "Follow-up Queue", "Persist / Render"],
    files: ["packages/coding-agent/src/core/agent-session.ts", "packages/coding-agent/src/core/agent-session-runtime.ts", "packages/coding-agent/src/core/event-bus.ts"],
    code: `session.prompt(message)\n\nEnter     → queueSteering(message)\nAlt+Enter → queueFollowUp(message)\n\nawait session.agent.waitForIdle()`,
    points: ["运行中可转向", "后续任务有序排队", "产品状态集中协调"],
    takeaway: "Pi 的交互感来自队列语义：用户不必等 Agent 停下，仍能精确决定新消息何时介入。",
  },
  {
    id: "P07",
    group: "会话交互",
    groupColor: "#25ad7c",
    title: "JSONL Tree：一个文件里的分支历史",
    kicker: "id / parentId",
    motto: "会话条目只追加，每个节点指向 parentId，于是线性日志自然长成树。",
    why: "编码任务经常需要回到旧消息尝试另一条路。复制整份聊天既浪费又会丢关联。pi 的 session JSONL 让 /tree 原地切分支，所有路径仍保存在同一个文件。",
    model: "像 Git commit graph：节点不改历史，只指向父节点；切换分支只是换当前 leaf。",
    flow: ["Session Header", "Entry id", "parentId", "Active Leaf", "/tree", "Branch Summary"],
    files: ["packages/coding-agent/src/core/session-manager.ts", "packages/coding-agent/docs/session-format.md", "packages/coding-agent/src/core/compaction/branch-summarization.ts"],
    code: `{ type: "message", id: "b2c3d4e5",\n  parentId: "a1b2c3d4", message: ... }\n\n// change leaf, append new child\n// old branch remains in the same JSONL`,
    points: ["追加式历史", "原地分支", "离开分支可摘要"],
    takeaway: "Pi 不把会话树藏在数据库里；一份可读 JSONL 就同时承担恢复、分支和导出。",
  },
  {
    id: "P08",
    group: "可塑产品",
    groupColor: "#e69f2d",
    title: "ResourceLoader × Extensions：最小核心之外的一切",
    kicker: "Discover / Reload / Extend",
    motto: "核心少内置工作流；技能、提示、主题、工具、命令和 UI 都从资源与扩展层进入。",
    why: "pi 刻意不内置 plan mode、subagent、权限弹窗或后台 Bash。DefaultResourceLoader 从全局、项目和 package 发现资源；ExtensionAPI 则统一注册工具、事件、命令、快捷键和 TUI。",
    model: "像一间空工作室：桌椅是默认工具，具体工种需要的夹具由项目带来，/reload 能在不重启工作室时重新布置。",
    flow: ["Global Resources", "Project .pi", "Pi Packages", "ResourceLoader", "ExtensionAPI", "AgentSession / TUI"],
    files: ["packages/coding-agent/src/core/resource-loader.ts", "packages/coding-agent/src/core/extensions", "packages/coding-agent/docs/extensions.md"],
    code: `pi.on("tool_call", guard)\npi.registerTool(tool)\npi.registerCommand("plan", handler)\npi.registerShortcut("ctrl+t", action)\n\n/reload // refresh resources in place`,
    points: ["统一资源发现", "扩展可热重载", "工作流不绑死核心"],
    takeaway: "Pi 的最小主义不是功能少，而是拒绝替你决定工作流；扩展面本身才是产品主角。",
  },
];

const projects = {
  dsh: {
    title: "拆解 DeepSeek Harness",
    label: "DSH",
    accent: "#4f8df7",
    intro: "一个把模型、工具、会话、循环和 UI 全部做成插件的 Agent Harness，如何靠 Cordis 组合成产品。",
    repo: "https://github.com/deepseek-ai/deepseek-harness",
    language: "TypeScript · Cordis",
    lessons: dshLessons,
  },
  pi: {
    title: "拆解 PI Agent",
    label: "PI Agent",
    accent: "#ef684c",
    intro: "一个极简终端 Coding Harness，如何用分层包、会话树与扩展系统，把工作流选择权交还给使用者。",
    repo: "https://github.com/badlogic/pi-mono",
    language: "TypeScript · TUI",
    lessons: piLessons,
  },
  nanobot: {
    title: "拆解 nanobot",
    label: "nanobot",
    accent: "#ffb11b",
    intro: "一只很轻的个人 Agent，如何从消息总线一路长成多渠道、可记忆、可持续运行的产品。",
    repo: "https://github.com/HKUDS/nanobot",
    language: "Python · React",
    lessons: nanobotLessons,
  },
} as const;

function routeFromHash(): RouteKey {
  if (typeof window === "undefined") return "home";
  const route = window.location.hash.replace("#/", "").split("/")[0];
  if (route === "dsh" || route === "pi" || route === "nanobot" || route === "compare") return route;
  return "home";
}

export default function Home() {
  const [route, setRoute] = useState<RouteKey>("home");
  const [lessonId, setLessonId] = useState<Record<ProjectKey, string>>({ dsh: "D01", pi: "P01", nanobot: "N01" });
  const [tab, setTab] = useState<"lecture" | "source">("lecture");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = routeFromHash();
      setRoute(next);
      const bits = window.location.hash.replace("#/", "").split("/");
      if ((next === "dsh" || next === "pi" || next === "nanobot") && bits[1]) {
        const valid = projects[next].lessons.some((lesson) => lesson.id === bits[1]);
        if (valid) setLessonId((current) => ({ ...current, [next]: bits[1] }));
      }
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = (next: RouteKey, lesson?: string) => {
    window.location.hash = next === "home" ? "#/" : `#/${next}${lesson ? `/${lesson}` : ""}`;
  };

  const selectLesson = (project: ProjectKey, id: string) => {
    setLessonId((current) => ({ ...current, [project]: id }));
    setTab("lecture");
    window.location.hash = `#/${project}/${id}`;
  };

  return (
    <div className="site-shell">
      <Header route={route} navigate={navigate} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      {route === "home" && <Landing navigate={navigate} />}
      {(route === "dsh" || route === "pi" || route === "nanobot") && (
        <CoursePage
          projectKey={route}
          selectedId={lessonId[route]}
          selectLesson={selectLesson}
          tab={tab}
          setTab={setTab}
        />
      )}
      {route === "compare" && <Compare navigate={navigate} />}
    </div>
  );
}

function Header({
  route,
  navigate,
  menuOpen,
  setMenuOpen,
}: {
  route: RouteKey;
  navigate: (route: RouteKey) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}) {
  const [dark, setDark] = useState(false);
  const sourceRepo = route === "dsh" || route === "pi" || route === "nanobot"
    ? projects[route].repo
    : projects.dsh.repo;

  useEffect(() => {
    const saved = window.localStorage.getItem("agent-unpacked-theme") === "dark";
    setDark(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "light";
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("agent-unpacked-theme", next ? "dark" : "light");
  };

  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate("home")} aria-label="返回首页">
        <span className="brand-mark"><i /><i /></span>
        <span className="brand-name">agent-unpacked</span>
        <span className="brand-sub">拆开 Agent，看见系统</span>
      </button>
      <button className="mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <nav className={menuOpen ? "topnav open" : "topnav"} aria-label="主导航">
        {([
          ["home", "学习入口"],
          ["dsh", "拆 DSH"],
          ["pi", "拆 PI"],
          ["nanobot", "拆 nanobot"],
          ["compare", "横向对照"],
        ] as [RouteKey, string][]).map(([key, label]) => (
          <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>
        ))}
        <a className="github-button" href={sourceRepo} target="_blank" rel="noreferrer" aria-label="查看当前项目 GitHub">GH</a>
        <button className="theme-button" onClick={toggleTheme} aria-label="切换明暗主题">{dark ? "☀" : "◐"}</button>
      </nav>
    </header>
  );
}

function Landing({ navigate }: { navigate: (route: RouteKey) => void }) {
  return (
    <main className="landing">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span /> SOURCE-GUIDED · 逐层拆解</div>
          <h1>别只会用 Agent，<br /><em>看懂它为什么能工作。</em></h1>
          <p>三条源码路线，一套统一问题：消息怎么进来、上下文怎么组装、模型如何调用工具、状态如何留下、系统如何长成产品。</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => navigate("dsh")}>从 DSH 开始 <span>→</span></button>
            <button className="text-action" onClick={() => navigate("compare")}>先看三者差异</button>
          </div>
          <div className="hero-stats">
            <div><strong>24</strong><span>节架构课</span></div>
            <div><strong>3</strong><span>源码路线</span></div>
            <div><strong>1</strong><span>统一心智模型</span></div>
          </div>
        </div>
        <SystemSketch />
      </section>

      <section className="route-section">
        <div className="section-heading">
          <span>选择一条路线</span>
          <p>三个项目都从 Agent Loop 出发，却给出了插件组合、极简扩展与产品分层三种答案。</p>
        </div>
        <div className="route-cards">
          <RouteCard project="dsh" navigate={navigate} />
          <RouteCard project="pi" navigate={navigate} />
          <RouteCard project="nanobot" navigate={navigate} />
        </div>
      </section>

      <section className="method-strip">
        <span className="method-number">00</span>
        <div><small>阅读方法</small><h2>每一层都问同样的四个问题</h2></div>
        {["输入是什么？", "状态归谁？", "扩展点在哪？", "失败如何收口？"].map((item, index) => (
          <div className="method-question" key={item}><span>0{index + 1}</span>{item}</div>
        ))}
      </section>
    </main>
  );
}

function SystemSketch() {
  return (
    <div className="system-sketch" aria-label="Agent 系统分层示意图">
      <div className="sketch-caption"><span>LIVE SYSTEM MAP</span><i /></div>
      <div className="sketch-layer input-layer">
        <small>01 · SURFACE</small>
        <div><span>CLI</span><span>WEB</span><span>CHAT</span></div>
      </div>
      <div className="sketch-arrow">↓ <span>统一输入</span></div>
      <div className="sketch-layer core-layer">
        <small>02 · AGENT CORE</small>
        <div className="loop-ring"><b>CONTEXT</b><strong>AGENT<br />LOOP</strong><b>STATE</b></div>
      </div>
      <div className="sketch-branches">
        <div><small>03A</small><strong>LLM</strong><span>provider</span></div>
        <div><small>03B</small><strong>TOOLS</strong><span>execute</span></div>
        <div><small>03C</small><strong>MEMORY</strong><span>persist</span></div>
      </div>
      <div className="sketch-note">真正的复杂度，不在 while；在边界。</div>
    </div>
  );
}

function RouteCard({ project, navigate }: { project: ProjectKey; navigate: (route: RouteKey) => void }) {
  const data = projects[project];
  const routeIndex: Record<ProjectKey, string> = { dsh: "ROUTE A", pi: "ROUTE B", nanobot: "ROUTE C" };
  const routeIcon: Record<ProjectKey, string> = { dsh: "dsh / core", pi: "pi / agent", nanobot: "nano / bot" };
  return (
    <button className={`route-card ${project}`} onClick={() => navigate(project)}>
      <div className="route-card-top">
        <span className="route-index">{routeIndex[project]}</span>
        <span className="route-lang">{data.language}</span>
      </div>
      <div className="route-icon">{routeIcon[project]}</div>
      <h2>{data.title}</h2>
      <p>{data.intro}</p>
      <div className="route-modules">
        {[...new Set(data.lessons.map((lesson) => lesson.group))].map((group, index) => <span key={group}>{String(index + 1).padStart(2, "0")} {group}</span>)}
      </div>
      <div className="route-footer"><span>{data.lessons.length} LESSONS</span><b>进入路线 →</b></div>
    </button>
  );
}

function CoursePage({
  projectKey,
  selectedId,
  selectLesson,
  tab,
  setTab,
}: {
  projectKey: ProjectKey;
  selectedId: string;
  selectLesson: (project: ProjectKey, id: string) => void;
  tab: "lecture" | "source";
  setTab: (tab: "lecture" | "source") => void;
}) {
  const data = projects[projectKey];
  const lesson = data.lessons.find((item) => item.id === selectedId) ?? data.lessons[0];
  const index = data.lessons.findIndex((item) => item.id === lesson.id);
  const groups = useMemo(() => [...new Set(data.lessons.map((item) => item.group))], [data.lessons]);

  return (
    <div className="course-layout">
      <aside className="course-sidebar">
        <div className="course-identity">
          <small>当前路线</small>
          <strong>{data.title}</strong>
          <span>{data.language}</span>
        </div>
        <nav aria-label={`${data.label} 课程目录`}>
          {groups.map((group) => {
            const lessons = data.lessons.filter((item) => item.group === group);
            return (
              <div className="lesson-group" key={group}>
                <div className="group-name"><i style={{ background: lessons[0].groupColor }} />{group}</div>
                {lessons.map((item) => (
                  <button key={item.id} className={item.id === lesson.id ? "selected" : ""} onClick={() => selectLesson(projectKey, item.id)}>
                    <span>{item.id}</span><b>{item.title.split("：")[0]}</b>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <a href={data.repo} target="_blank" rel="noreferrer" className="repo-link">查看官方源码 <span>↗</span></a>
      </aside>

      <main className="lesson-main">
        <div className="breadcrumbs"><span>学习路径</span><i>/</i><span>{lesson.group}</span><i>/</i><b>{lesson.id}</b></div>
        <div className="lesson-kicker"><span>{lesson.id}</span>{lesson.kicker}</div>
        <h1>{lesson.title}</h1>
        <blockquote style={{ borderColor: lesson.groupColor }}>{lesson.motto}</blockquote>

        <div className="lesson-tabs">
          <button className={tab === "lecture" ? "active" : ""} onClick={() => setTab("lecture")}>讲义</button>
          <button className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>源码地图 <span>{lesson.files.length}</span></button>
        </div>

        {tab === "lecture" ? <Lecture lesson={lesson} /> : <SourceMap lesson={lesson} project={projectKey} />}

        <div className="lesson-pagination">
          <button disabled={index === 0} onClick={() => selectLesson(projectKey, data.lessons[index - 1]?.id)}>
            <span>← 上一课</span><b>{data.lessons[index - 1]?.title ?? "已经是第一课"}</b>
          </button>
          <button className="next" disabled={index === data.lessons.length - 1} onClick={() => selectLesson(projectKey, data.lessons[index + 1]?.id)}>
            <span>下一课 →</span><b>{data.lessons[index + 1]?.title ?? "路线完成"}</b>
          </button>
        </div>
      </main>

      <aside className="lesson-rail">
        <div className="rail-progress"><span>路线进度</span><b>{String(index + 1).padStart(2, "0")} / {String(data.lessons.length).padStart(2, "0")}</b><i><em style={{ width: `${((index + 1) / data.lessons.length) * 100}%`, background: data.accent }} /></i></div>
        <div className="rail-toc"><span>本页</span><a href="#why">为什么需要</a><a href="#model">心智模型</a><a href="#flow">运行路径</a><a href="#takeaway">一句话带走</a></div>
        <div className="rail-note"><span>源码阅读提示</span><p>先找到边界，再追实现。优先看输入、状态拥有者和失败出口。</p></div>
      </aside>
    </div>
  );
}

function Lecture({ lesson }: { lesson: Lesson }) {
  return (
    <article className="lecture">
      <section id="why">
        <div className="section-number">01</div>
        <div><h2>为什么需要这一层</h2><p>{lesson.why}</p></div>
      </section>
      <section id="model">
        <div className="section-number">02</div>
        <div><h2>心智模型</h2><div className="mental-model"><span>↳</span><p>{lesson.model}</p></div></div>
      </section>
      <section id="flow">
        <div className="section-number">03</div>
        <div className="section-wide"><h2>运行路径</h2><FlowDiagram steps={lesson.flow} color={lesson.groupColor} /></div>
      </section>
      <section>
        <div className="section-number">04</div>
        <div className="section-wide"><h2>这一层解决了什么</h2><div className="point-grid">{lesson.points.map((point, index) => <div key={point}><span>0{index + 1}</span><b>{point}</b></div>)}</div></div>
      </section>
      <section id="takeaway">
        <div className="section-number">05</div>
        <div className="section-wide"><h2>一句话带走</h2><div className="takeaway">{lesson.takeaway}</div></div>
      </section>
    </article>
  );
}

function FlowDiagram({ steps, color }: { steps: string[]; color: string }) {
  return (
    <div className="flow-diagram">
      {steps.map((step, index) => (
        <div className="flow-fragment" key={step}>
          <div className="flow-node"><small>{String(index + 1).padStart(2, "0")}</small><strong>{step}</strong><i style={{ background: color }} /></div>
          {index < steps.length - 1 && <span className="flow-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}

function SourceMap({ lesson, project }: { lesson: Lesson; project: ProjectKey }) {
  return (
    <article className="source-map">
      <div className="source-intro"><span>SOURCE WALK</span><h2>从这 {lesson.files.length} 个位置开始追</h2><p>路径来自当前官方仓库的架构文档；示意代码用于突出控制流，不是逐字复制。</p></div>
      <div className="file-stack">
        {lesson.files.map((file, index) => (
          <a key={file} href={`${projects[project].repo}/tree/main/${file.replace(/^vendor\/cordis$/, "vendor/cordis")}`} target="_blank" rel="noreferrer">
            <span>{String(index + 1).padStart(2, "0")}</span><code>{file}</code><b>↗</b>
          </a>
        ))}
      </div>
      <div className="code-window">
        <div className="code-title"><span><i /><i /><i /></span><b>{lesson.id.toLowerCase()}_control_flow</b><small>concept sketch</small></div>
        <pre><code>{lesson.code}</code></pre>
      </div>
      <div className="reading-order"><span>推荐顺序</span><p><b>定义</b> → 看它承诺什么</p><p><b>组装</b> → 看谁创建它</p><p><b>消费</b> → 看结果流向哪里</p></div>
    </article>
  );
}

function Compare({ navigate }: { navigate: (route: RouteKey) => void }) {
  const rows = [
    ["核心组织方式", "Cordis 插件树 + ctx", "四层包 + 极简核心", "分层 Python 模块 + 注册表"],
    ["消息入口", "Agent inbox + typed events", "AgentSession + 双消息队列", "异步 MessageBus"],
    ["Agent 执行", "agent-loop 插件 + turn/step", "Agent core + 事件流", "AgentLoop / AgentRunner 分工"],
    ["状态真源", "append-only SessionEvent", "JSONL tree + active leaf", "Session 历史 +长期 Memory"],
    ["扩展工具", "ctx.tools + waterfall 管线", "ExtensionAPI + tool hooks", "ToolRegistry / plugin entry points"],
    ["模型替换", "ctx.llm seam provider", "pi-ai provider stream", "Provider 接口与 registry"],
    ["产品组装", "Profile / Bundle / patch", "ResourceLoader + CLI / SDK / RPC", "Gateway 作为 composition root"],
    ["最强教学价值", "高度可组合、边界极致显式", "最小内核、工作流完全可塑", "清晰、直接、容易追调用链"],
  ];
  return (
    <main className="compare-page">
      <div className="compare-hero">
        <div className="eyebrow"><span /> SIDE BY SIDE · 横向对照</div>
        <h1>同一个 Agent 问题，<br /><em>三种系统答案。</em></h1>
        <p>DSH 选择彻底的插件组合；PI 选择极简内核与用户扩展；nanobot 选择清晰的应用分层。它们不是强弱关系，而是不同的复杂度预算。</p>
      </div>
      <div className="comparison-table">
        <div className="comparison-head"><span>架构问题</span><button onClick={() => navigate("dsh")}><b>DSH</b><small>Composable Harness</small></button><button onClick={() => navigate("pi")}><b>PI Agent</b><small>Minimal &amp; Extensible</small></button><button onClick={() => navigate("nanobot")}><b>nanobot</b><small>Readable Application</small></button></div>
        {rows.map((row, index) => <div className="comparison-row" key={row[0]}><span><small>{String(index + 1).padStart(2, "0")}</small>{row[0]}</span><p>{row[1]}</p><p>{row[2]}</p><p>{row[3]}</p></div>)}
      </div>
      <section className="choice-section">
        <div><span>如果你更关心</span><h2>如何构建可换骨架的 Harness</h2><p>先读 DSH。它把插件生命周期、事件溯源、能力 seam 与产品组合都变成一等架构概念。</p><button onClick={() => navigate("dsh")}>进入 DSH 路线 →</button></div>
        <div><span>如果你更关心</span><h2>如何把工作流选择权交给用户</h2><p>先读 PI。它用极小 Agent core、会话树和统一扩展 API，展示“少内置、多可塑”的 Coding Harness。</p><button onClick={() => navigate("pi")}>进入 PI Agent 路线 →</button></div>
        <div><span>如果你更关心</span><h2>从一个能跑的个人 Agent 学起</h2><p>先读 nanobot。调用链短，Python 模块边界直接，消息、上下文、工具和记忆都能很快找到落点。</p><button onClick={() => navigate("nanobot")}>进入 nanobot 路线 →</button></div>
      </section>
      <section className="final-thesis"><small>THE THESIS</small><blockquote>DSH 教你把 Agent <em>换得掉</em>；PI 教你把工作流<em>交出去</em>；nanobot 教你把系统<em>分清楚</em>。</blockquote></section>
    </main>
  );
}
