"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ProjectKey = "dsh" | "pi" | "nanobot" | "claude" | "openclaw";
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

type LessonDetail = {
  architecture: string;
  evidence: Array<{
    file: string;
    symbol: string;
    note: string;
  }>;
};

type CourseOverviewData = {
  eyebrow: string;
  headline: string;
  thesis: string;
  tension: string;
  principles: Array<{ title: string; detail: string }>;
  journey: string[];
  questions: Array<{ question: string; answer: string }>;
  bestFor: string[];
  tradeoffs: string[];
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

const claudeLessons: Lesson[] = [
  {
    id: "C01", group: "公开边界", groupColor: "#d97757", title: "SDK × CLI：公开源码到底覆盖哪一层", kicker: "Public Boundary",
    motto: "Claude Code 核心不是完整开源项目；能可靠拆解的是官方 Agent SDK、插件、Hook 与 CLI 协议边界。",
    why: "如果把公开 SDK 当成 Claude Code 全部内核，就会把进程桥接误读成 Agent Loop 实现。第一课先画清可验证边界：Python SDK 负责 API、类型与控制通道，实际推理由 Claude Code CLI 进程完成。",
    model: "像遥控器与电视：遥控器的按键、电报码和状态反馈可以拆开研究，但屏幕后面的图像处理芯片仍在电视内部。",
    flow: ["Python API", "ClaudeSDKClient", "Query", "SubprocessCLITransport", "Claude Code CLI", "Typed Messages"],
    files: ["src/claude_agent_sdk/query.py", "src/claude_agent_sdk/client.py", "src/claude_agent_sdk/_internal/transport/subprocess_cli.py"],
    code: `async for message in query(prompt, options):\n    handle(message)\n\n# SDK launches the official CLI\n# and exchanges newline-delimited JSON`,
    points: ["公开范围不夸大", "SDK 与运行内核分层", "只使用官方证据"],
    takeaway: "研究 Claude Code 时，第一件事不是猜内部 while，而是标出哪些结论能由官方公开源码直接证明。",
  },
  {
    id: "C02", group: "进程协议", groupColor: "#4f8df7", title: "Subprocess Transport：SDK 如何驱动 Claude Code", kicker: "Process / NDJSON",
    motto: "SDK 始终使用流式模式，通过子进程 stdin/stdout 交换 NDJSON，而不是把 CLI 当普通函数调用。",
    why: "长时间 Agent 运行会不断产生文本、工具调用、Hook 和控制消息。一次性等待进程退出无法支持中断、权限回调与实时 UI，因此 transport 必须拥有进程和双向流生命周期。",
    model: "像演播室导播间：主持人一直在直播，导播通过耳返持续下指令，同时接收每一段现场信号。",
    flow: ["ClaudeAgentOptions", "CLI Discovery", "Process Spawn", "stdin NDJSON", "stdout NDJSON", "Message Parser"],
    files: ["src/claude_agent_sdk/_internal/transport/subprocess_cli.py", "src/claude_agent_sdk/_internal/query.py", "src/claude_agent_sdk/_errors.py"],
    code: `transport = SubprocessCLITransport(prompt, options)\nawait transport.connect()\nasync for raw in transport.receive_messages():\n    yield parse_message(raw)`,
    points: ["CLI 查找与启动", "并发读写锁", "缓冲与错误边界"],
    takeaway: "Claude Agent SDK 的核心地基是一条可靠的双向进程协议；Agent 能力在另一端，SDK 负责把它变成可编程接口。",
  },
  {
    id: "C03", group: "进程协议", groupColor: "#4f8df7", title: "Message Union：把 CLI 事件变成类型世界", kicker: "Parser / Content Blocks",
    motto: "文本、思考、工具、任务、Hook 与最终结果不是字符串日志，而是可区分、可演进的消息联合类型。",
    why: "如果所有输出只是 console text，应用无法知道何时展示思考、何时请求权限、何时关联 tool_result，也无法兼容新增事件。parser 把原始 JSON 翻译成稳定对象。",
    model: "像海关分流：每件包裹先看申报类型，再进入文本、工具、任务或系统事件的不同通道。",
    flow: ["Raw JSON", "parse_message()", "Message Type", "ContentBlock", "Hook / Task Events", "Application"],
    files: ["src/claude_agent_sdk/_internal/message_parser.py", "src/claude_agent_sdk/types.py", "tests/test_message_parser.py"],
    code: `match data["type"]:\n    case "assistant": return AssistantMessage(...)\n    case "system": return SystemMessage(...)\n    case "result": return ResultMessage(...)`,
    points: ["消息可判别", "内容块可组合", "未知字段向前兼容"],
    takeaway: "真正稳定的集成面不是终端输出长什么样，而是 SDK 能否把每种生命周期事实表达成明确类型。",
  },
  {
    id: "C04", group: "控制与安全", groupColor: "#a85ce5", title: "Bidirectional Control：运行中如何中断与改策略", kicker: "Control Requests",
    motto: "持续连接的价值不只在流式输出，还在于应用能在运行中发送 interrupt、切模型、改权限与查询状态。",
    why: "Agent 不是只读生成器。产品需要停止任务、切换 permission mode、重连 MCP、查询 context usage，SDK 因此设计了 request/response 对应的控制通道。",
    model: "像飞机驾驶舱：仪表持续回传状态，飞行员也能随时改变航向、模式或终止某个动作。",
    flow: ["Client Method", "Control Request", "Request ID", "CLI Handler", "Control Response", "Running Session"],
    files: ["src/claude_agent_sdk/client.py", "src/claude_agent_sdk/_internal/query.py", "src/claude_agent_sdk/types.py"],
    code: `await client.set_permission_mode("acceptEdits")\nawait client.set_model("claude-sonnet")\nusage = await client.get_context_usage()\nawait client.interrupt()`,
    points: ["请求响应关联", "运行时可控", "状态查询显式化"],
    takeaway: "流式 Agent 的完整协议必须双向：既能观察它做了什么，也能在明确边界改变它接下来怎么做。",
  },
  {
    id: "C05", group: "控制与安全", groupColor: "#a85ce5", title: "Hooks × Permissions：工具执行前后谁能干预", kicker: "PreToolUse / Policy",
    motto: "Hook 观察生命周期，Permission callback 决定一次调用能否继续；两者共同把安全策略放在工具边界。",
    why: "文件写入、Shell 与网络访问不能只依赖模型自律。SDK 暴露 PreToolUse、PostToolUse、Stop、PreCompact 等事件，并允许回调允许、拒绝或修改工具输入。",
    model: "像工厂质检门：原料进车间前先验权限，生产完成后再留记录；异常时可以立即叫停。",
    flow: ["HookMatcher", "PreToolUse", "Permission Callback", "Tool Execution", "PostToolUse", "Hook Event"],
    files: ["src/claude_agent_sdk/types.py", "examples/hooks.py", "examples/tool_permission_callback.py"],
    code: `async def can_use_tool(name, input, context):\n    if name == "Bash" and is_risky(input):\n        return PermissionResultDeny(message="blocked")\n    return PermissionResultAllow(updated_input=input)`,
    points: ["生命周期可观察", "调用可拒绝或改写", "策略与工具解耦"],
    takeaway: "安全不是工具内部散落的 if；它应当成为每次能力调用必经、可记录、可组合的协议关口。",
  },
  {
    id: "C06", group: "控制与安全", groupColor: "#a85ce5", title: "SDK MCP Tools：Python 函数如何进入 Agent", kicker: "@tool / MCP",
    motto: "装饰器生成 schema，进程内 MCP Server 暴露能力，CLI 仍通过标准 MCP 调用，而不是直接 import 用户函数。",
    why: "应用希望把数据库、业务 API 或计算函数交给 Claude 使用，同时保留参数类型和进程边界。SDK 把 Python callable 包装成 MCP tool，使外部能力走统一协议。",
    model: "像把自家厨房接入外卖平台：菜品、参数和结果都按平台协议发布，骑手不需要进入厨房内部。",
    flow: ["@tool", "JSON Schema", "SDK MCP Server", "Initialize", "Tool Call", "Tool Result"],
    files: ["src/claude_agent_sdk/__init__.py", "examples/mcp_calculator.py", "src/claude_agent_sdk/types.py"],
    code: `@tool("add", "Add two numbers", {"a": float, "b": float})\nasync def add(args):\n    return {"content": [{"type": "text", "text": str(args["a"] + args["b"])}]}`,
    points: ["类型转 JSON Schema", "进程内 MCP", "工具协议统一"],
    takeaway: "SDK 工具不是特殊捷径；它把本地函数正规化为 MCP 能力，因而能沿用同一套发现、调用与结果语义。",
  },
  {
    id: "C07", group: "会话与扩展", groupColor: "#25ad7c", title: "SessionStore：会话怎样镜像、恢复与迁移", kicker: "Transcript / Resume",
    motto: "CLI 产生 JSONL transcript，SDK 将增量帧镜像进可替换 SessionStore，并用 project_key、session_id 与 subpath 保持层级。",
    why: "只依赖本机文件会限制服务器部署、横向扩展和备份。SessionStore 契约让 Postgres、Redis、S3 等后端保存同样的追加式会话，并支持恢复和子 Agent transcript。",
    model: "像银行流水异地备份：柜台仍生成原始流水，但后台持续复制到统一账本，换机器后也能从同一编号继续。",
    flow: ["CLI Transcript", "Mirror Batcher", "SessionStore.append", "Summary Sidecar", "Resume", "Next Query"],
    files: ["src/claude_agent_sdk/_internal/session_store.py", "src/claude_agent_sdk/_internal/transcript_mirror_batcher.py", "src/claude_agent_sdk/_internal/session_resume.py"],
    code: `await store.append(session_key, entries)\nentries = await store.load(session_key)\nawait import_session_to_cli(entries)\n# resume with the same session id`,
    points: ["追加式持久化", "后端可替换", "主会话与子会话分层"],
    takeaway: "会话可迁移的关键不是复制 prompt，而是保留原始 transcript 的顺序、身份和子路径语义。",
  },
  {
    id: "C08", group: "会话与扩展", groupColor: "#25ad7c", title: "Agents × Plugins：把工作流配置送进 CLI", kicker: "Definitions / Settings",
    motto: "AgentDefinition、setting_sources 与 Plugin config 通过 initialize 配置进入 Claude Code，SDK 负责声明而不是重写运行时。",
    why: "产品需要不同子 Agent、系统提示、工具集合和插件目录。如果每次都手工拼 CLI 参数，配置会不可复用；结构化 options 让应用以数据声明工作流。",
    model: "像剧组通告单：角色、台词规则、可用道具和场地来源先写成配置，开拍时统一交给现场执行。",
    flow: ["AgentDefinition", "ClaudeAgentOptions", "setting_sources", "Plugin Config", "Initialize", "Subagent / Skill"],
    files: ["src/claude_agent_sdk/types.py", "examples/agents.py", "examples/plugin_example.py"],
    code: `options = ClaudeAgentOptions(\n    agents={"reviewer": AgentDefinition(...)},\n    plugins=[{"type": "local", "path": plugin_dir}],\n    setting_sources=["project"],\n)`,
    points: ["子 Agent 数据化", "配置来源可控", "插件目录可注入"],
    takeaway: "公开 SDK 展示的扩展哲学是“声明能力并交给 CLI 执行”，而不是在 SDK 里复制另一套 Claude Code。",
  },
];

const openclawLessons: Lesson[] = [
  {
    id: "O01", group: "运行时地图", groupColor: "#ef684c", title: "五层运行时：OpenClaw 不只是一个 Agent Loop", kicker: "Core / Runtime / Product",
    motto: "agent-core 管循环，embedded runner 管尝试，runtime 做门面，Gateway 管产品，plugin-sdk 划公开边界。",
    why: "OpenClaw 同时服务聊天渠道、TUI、Cron、API 与插件。如果把所有职责看成一个 Agent 类，就无法判断状态、模型、会话和基础设施分别归谁。",
    model: "像操作系统分层：内核只管基本调度，驱动适配硬件，系统服务管理长期资源，应用与插件通过公开接口进入。",
    flow: ["Channels / Gateway", "Harness Selection", "Embedded Runner", "agent-core", "LLM / Tools", "Sessions"],
    files: ["docs/agent-runtime-architecture.md", "packages/agent-core/src/index.ts", "src/agents/runtime/index.ts"],
    code: `// product chooses a harness\nconst harness = selectAgentHarness(policy)\n\n// built-in runtime delegates the loop\nreturn runAgentHarnessAttempt(harness, params)`,
    points: ["五层职责分明", "公开 SDK 边界", "产品与循环解耦"],
    takeaway: "读 OpenClaw 先画运行时地图；否则你会在 Gateway、Harness、Runner 与 Core 之间来回迷路。",
  },
  {
    id: "O02", group: "运行时地图", groupColor: "#ef684c", title: "agent-core：从模型流到工具结果的最小闭环", kicker: "Agent / Loop",
    motto: "Agent 持有可观察状态与消息队列，agent-loop 负责模型流、工具批次、steering checkpoint 与退出条件。",
    why: "工具可能顺序或并行执行，用户可能中途 steering，某个结果还可能污染当前 turn。将这些边界集中在 core，外围产品就不用复制复杂循环。",
    model: "像列车调度中心：一趟列车是 turn，每个站是 tool call；调度中心决定并行、等待、插队和终点。",
    flow: ["Agent.prompt", "runLoop", "streamAssistantResponse", "Tool Batch", "Tool Results", "Next Turn / End"],
    files: ["packages/agent-core/src/agent.ts", "packages/agent-core/src/agent-loop.ts", "packages/agent-core/src/types.ts"],
    code: `const stream = agentLoop(prompts, context, config)\nfor await (const event of stream) emit(event)\n// tool results may trigger another model turn`,
    points: ["状态与执行分离", "工具批次显式", "中断和 steering 有检查点"],
    takeaway: "OpenClaw core 的复杂度不在 while 本身，而在一次 turn 内如何安全处理流、并发工具和用户介入。",
  },
  {
    id: "O03", group: "运行时地图", groupColor: "#ef684c", title: "Embedded Runner：一次尝试如何落到真实环境", kicker: "Attempt / Recovery",
    motto: "Runner 把模型选择、系统提示、工具策略、transcript、compaction 与失败恢复组装成一次可执行 attempt。",
    why: "可复用 core 不应知道 OpenClaw 的认证、沙箱、渠道元数据或 fallback model。embedded runner 在产品边界准备这些现实条件，再调用 core。",
    model: "像赛车进站：底层发动机不关心天气和轮胎；车队在每次出发前完成配置、检查和故障预案。",
    flow: ["Run Request", "Prepared Runtime", "Attempt Setup", "Agent Loop", "Compaction / Retry", "Run Result"],
    files: ["src/agents/embedded-agent-runner/run.ts", "src/agents/embedded-agent-runner/run/attempt.ts", "src/agents/embedded-agent-runner/run-orchestrator.ts"],
    code: `const prepared = await prepareRuntime(params)\nreturn runAttempt({ ...params, prepared })\n// overflow may compact and retry with a successor attempt`,
    points: ["每次尝试可隔离", "恢复策略在外围", "核心不承载产品配置"],
    takeaway: "Runner 是 OpenClaw 内核与真实产品世界的减压舱：所有易变策略在这里收口，再进入稳定循环。",
  },
  {
    id: "O04", group: "控制平面", groupColor: "#4f8df7", title: "Gateway × Channel：多入口如何汇入同一执行面", kicker: "Ingress / Delivery",
    motto: "Gateway 拥有长期服务与协议，Channel message pipeline 负责可靠接收、路由、运行和最终投递。",
    why: "聊天平台会重复投递、断线重试、线程回复并携带不同身份。直接调用 Agent 无法处理 custody、debounce、dead letter 和 durable delivery。",
    model: "像国际物流中心：不同快递先验收、贴统一路由单，再进入仓库处理；出库也有回执和失败重投。",
    flow: ["Channel Receive", "Ingress Queue", "Route Resolve", "run-channel-turn", "Agent Runtime", "Durable Delivery"],
    files: ["src/gateway/server-start.ts", "src/channels/message/receive.ts", "src/channels/turn/run-channel-turn.ts"],
    code: `const receipt = await receiveInbound(message)\nconst route = resolveAgentRoute(receipt)\nconst result = await runChannelTurn(route)\nawait deliverWithCustody(result)`,
    points: ["入口可靠性", "协议与推理解耦", "投递结果可追踪"],
    takeaway: "OpenClaw 更像个人 Agent 操作系统，因为它把消息可靠性和服务生命周期当作一等控制平面。",
  },
  {
    id: "O05", group: "控制平面", groupColor: "#4f8df7", title: "Routing × Session Key：消息究竟属于哪个 Agent", kicker: "Bindings / Identity",
    motto: "Channel、账号、peer、线程与绑定规则共同解析出 agentId 和 session key，而不是把所有消息塞进 main。",
    why: "一个 OpenClaw 实例可以托管多个隔离 Agent，并让不同 Discord、Telegram 或账号进入不同工作区。错误路由会造成记忆、权限和身份串线。",
    model: "像医院分诊：先根据科室、病人、挂号来源和当前会诊关系确定病历号，再把请求送到正确医生。",
    flow: ["Channel Account", "Peer / Thread", "Binding Rules", "resolveAgentRoute", "Session Key", "Agent Workspace"],
    files: ["src/routing/resolve-route.ts", "src/routing/session-key.ts", "docs/channels/channel-routing.md"],
    code: `const route = resolveAgentRoute({ channel, account, peer, thread })\nconst sessionKey = buildSessionKey(route)\n// agentId and workspace now stay isolated`,
    points: ["多 Agent 隔离", "线程连续性", "绑定优先级显式"],
    takeaway: "多 Agent 的第一道安全边界不是 prompt，而是路由与 session key 是否稳定、可解释、不会串线。",
  },
  {
    id: "O06", group: "模型与工具", groupColor: "#a85ce5", title: "Prepared Model Runtime：模型目录为何要做原子快照", kicker: "Generation / Catalog",
    motto: "Gateway 为每个 Agent 发布完整的 model runtime generation；运行时从快照 fork 可变认证与 registry，不重复半套发现。",
    why: "模型配置、插件和认证会热更新。如果 catalog、auth 和 registry 各自独立刷新，一次请求可能读到新旧混合状态。prepared generation 用完整替换保证一致性。",
    model: "像发布新地图版本：先在后台把道路、站点和权限全部生成完，再一次性切换；不能让用户拿到半张新图。",
    flow: ["Config / Auth", "Runtime Build", "Model Registry", "Atomic Publish", "Run Fork", "Provider Stream"],
    files: ["src/agents/prepared-model-runtime.ts", "src/agents/prepared-model-runtime.build.ts", "src/llm/model-registry.ts"],
    code: `const generation = await buildPreparedModelRuntime(config)\npublishPreparedModelRuntime(agentId, generation)\nconst runRuntime = generation.forkMutableStores()`,
    points: ["配置一致性", "发现结果复用", "每次运行可安全变更认证"],
    takeaway: "OpenClaw 把模型选择做成已发布的运行时世代，而不是每次请求临时拼配置，这是生产级一致性设计。",
  },
  {
    id: "O07", group: "模型与工具", groupColor: "#a85ce5", title: "Tools × Hooks：能力、策略与上下文预算", kicker: "Policy / Compaction",
    motto: "工具定义属于 OpenClaw，执行批次属于 core，allow/deny、沙箱与 compaction safeguard 通过策略和 Hook 横切接入。",
    why: "同一个 bash 或 edit 工具在私聊、群组、定时任务和插件 Harness 中可能拥有不同权限。策略必须围绕工具 surface 复用，长上下文也要在标准生命周期点压缩。",
    model: "像机场安检：航班负责运输，安检规则按乘客与目的地变化，行李超重则在进入登机口前重新整理。",
    flow: ["Tool Surface", "Effective Policy", "Prepare Call", "Execute / Sandbox", "Result Middleware", "Compaction Hook"],
    files: ["src/agents/agent-tools.ts", "packages/agent-core/src/agent-loop.ts", "src/agents/agent-hooks/compaction-safeguard.ts"],
    code: `const tools = buildAgentTools(context)\nconst allowed = applyEffectiveToolPolicy(tools, sender)\nconst result = await executeToolBatch(allowed)\nawait runCompactionSafeguard(context)`,
    points: ["工具与策略分离", "发送者级权限", "上下文预算有 Hook"],
    takeaway: "OpenClaw 的工具安全不是一个总开关，而是从渠道身份到 Harness 再到执行批次的分层政策。",
  },
  {
    id: "O08", group: "会话与插件", groupColor: "#25ad7c", title: "Sessions × Harness Registry：运行时怎样继续进化", kicker: "Resources / Plugins",
    motto: "Session 管持久树和资源，Harness registry 允许选择内置或插件运行时，plugin-sdk 则限制外部只能依赖公开 barrel。",
    why: "个人 Agent 会不断增加 skills、prompts、themes、extensions，甚至更换整个执行 Harness。若插件直接 import src 内部文件，每次重构都会破坏生态。",
    model: "像游戏主机：存档与资源包有统一格式，引擎可以切换，但第三方只能使用公开 SDK，不能焊接主板内部线路。",
    flow: ["Resource Manifest", "ResourceLoader", "AgentSession", "Harness Registry", "Selection Policy", "Plugin SDK"],
    files: ["src/agents/sessions/resource-loader.ts", "src/agents/harness/registry.ts", "src/agents/harness/selection.ts"],
    code: `registerAgentHarness(pluginHarness)\nconst selected = selectAgentHarness(policy)\nconst resources = await loader.reload()\nreturn selected.run({ session, resources })`,
    points: ["资源可发现", "Harness 可替换", "插件依赖方向受控"],
    takeaway: "OpenClaw 的终局不是无限扩大内置 Runner，而是让会话资源和替代 Harness 都通过稳定公开边界进入。",
  },
];

const lessonDetails: Record<string, LessonDetail> = {
  C01: {
    architecture: "官方 Python SDK 是 Claude Code 的可编程控制层：query / client 向上提供异步 API，SubprocessCLITransport 向下启动官方 CLI。CLI 内部 Agent Loop 不在该 SDK 仓库中。",
    evidence: [
      { file: "src/claude_agent_sdk/query.py", symbol: "query()", note: "一次性查询 API 创建内部 Query 与 transport，并把解析后的 Message 异步迭代给调用者。" },
      { file: "src/claude_agent_sdk/_internal/transport/subprocess_cli.py", symbol: "SubprocessCLITransport", note: "类注释和 _find_cli / connect 路径直接证明 SDK 通过 Claude Code CLI 子进程完成实际运行。" },
    ],
  },
  C02: {
    architecture: "SubprocessCLITransport 拥有 CLI 进程、stdin/stdout/stderr 流、写锁、缓冲上限与退出错误；上层 Query 只依赖 Transport 契约，不处理操作系统细节。",
    evidence: [
      { file: "src/claude_agent_sdk/_internal/transport/subprocess_cli.py", symbol: "connect / write / receive_messages", note: "查看进程创建、NDJSON 逐行读取和写锁，能确认双向流的生命周期由 transport 独占。" },
      { file: "src/claude_agent_sdk/_errors.py", symbol: "CLIConnectionError / ProcessError", note: "CLI 未找到、进程退出和 JSON 解码错误被区分成稳定 SDK 异常，而不是泄漏原始 stderr。" },
    ],
  },
  C03: {
    architecture: "message_parser 是不可信原始 JSON 与 SDK 类型世界之间的防腐层；types.py 定义 Message / ContentBlock 联合，上层应用不依赖 CLI 输出字符串。",
    evidence: [
      { file: "src/claude_agent_sdk/_internal/message_parser.py", symbol: "parse_message", note: "按 user、assistant、system、result 与 stream_event 分支构造类型，并对缺失字段抛出 MessageParseError。" },
      { file: "src/claude_agent_sdk/types.py", symbol: "AssistantMessage / ToolUseBlock / ResultMessage", note: "消息对象保留 model、usage、session_id、parent_tool_use_id 等关联信息，足以支持 UI 与状态机。" },
    ],
  },
  C04: {
    architecture: "ClaudeSDKClient 通过内部 Query 维持持续会话；interrupt、set_model、set_permission_mode 与 MCP 状态查询都编码成带 request_id 的控制请求。",
    evidence: [
      { file: "src/claude_agent_sdk/client.py", symbol: "interrupt / set_permission_mode / set_model", note: "这些公开方法不重启进程，而是调用 Query 控制接口修改当前连接中的运行时状态。" },
      { file: "src/claude_agent_sdk/_internal/query.py", symbol: "control request routing", note: "查看 pending response 与 request id 管理，可以验证多个控制请求如何与异步响应正确配对。" },
    ],
  },
  C05: {
    architecture: "HookMatcher 选择生命周期回调，can_use_tool 返回 allow / deny 结果；PreToolUse 可修改输入，PostToolUse 与 Stop 负责观察和收口。",
    evidence: [
      { file: "src/claude_agent_sdk/types.py", symbol: "HookMatcher / PermissionResultAllow / PermissionResultDeny", note: "类型明确列出 matcher、回调、updated_input 与 deny message，策略返回值不是约定字符串。" },
      { file: "examples/tool_permission_callback.py", symbol: "can_use_tool", note: "官方示例展示如何按工具名和输入做允许、拒绝或改写，是最小可运行的安全边界证据。" },
    ],
  },
  C06: {
    architecture: "@tool 将 Python 类型转为 JSON Schema，create_sdk_mcp_server 建立进程内 MCP Server；CLI 只看到标准 server config 与 tool result。",
    evidence: [
      { file: "src/claude_agent_sdk/__init__.py", symbol: "tool / create_sdk_mcp_server", note: "装饰器与 server factory 展示 callable、schema、handler 如何组合成 SdkMcpTool 和 MCP 配置。" },
      { file: "examples/mcp_calculator.py", symbol: "calculator MCP server", note: "官方计算器示例把多个 Python 函数发布给 Claude，并通过 options.mcp_servers 注入。" },
    ],
  },
  C07: {
    architecture: "TranscriptMirrorBatcher 从 CLI JSONL 增量收集帧，SessionStore 以 project_key / session_id / subpath 保存；resume 时再导回 CLI 可识别的会话。",
    evidence: [
      { file: "src/claude_agent_sdk/_internal/session_store.py", symbol: "SessionStore / InMemorySessionStore", note: "append、load、list、delete 与 list_subkeys 定义了可替换后端必须维持的追加式语义。" },
      { file: "src/claude_agent_sdk/_internal/transcript_mirror_batcher.py", symbol: "TranscriptMirrorBatcher", note: "批处理器解析 transcript 路径、聚合帧并写入 store，避免每个文件事件都触发一次远端写入。" },
    ],
  },
  C08: {
    architecture: "AgentDefinition、SdkPluginConfig 与 setting_sources 都属于 ClaudeAgentOptions；SDK 在 initialize 阶段把声明送入 CLI，由 CLI 按自己的插件与子 Agent 机制执行。",
    evidence: [
      { file: "src/claude_agent_sdk/types.py", symbol: "AgentDefinition / SdkPluginConfig / ClaudeAgentOptions", note: "定义展示 prompt、tools、model、skills、plugin path 与配置来源如何被结构化表达。" },
      { file: "examples/agents.py", symbol: "agents option", note: "官方示例创建多个不同职责的 AgentDefinition，并通过 options.agents 一次性交给运行时。" },
    ],
  },
  O01: {
    architecture: "OpenClaw 将产品控制平面、Harness 选择、embedded runner、可复用 agent-core、LLM transport 与 Session resources 分层；插件只能经 plugin-sdk barrel 进入。",
    evidence: [
      { file: "docs/agent-runtime-architecture.md", symbol: "Runtime Layout / Boundaries", note: "官方架构文档逐项列出 src/agents、packages/agent-core、src/llm 与 plugin-sdk 的所有权。" },
      { file: "src/agents/runtime/index.ts", symbol: "runtime facade", note: "门面将 agent-core 与 OpenClaw LLM runtime 绑定并重新导出，避免业务代码跨层拼接内部模块。" },
    ],
  },
  O02: {
    architecture: "Agent 类拥有状态、prompt 与 pending queue；agent-loop.ts 拥有模型流、工具批次、steering checkpoint、turn taint 与结束判定。",
    evidence: [
      { file: "packages/agent-core/src/agent.ts", symbol: "Agent / PendingMessageQueue", note: "从 prompt、steer 与 state 更新路径可以看到可观察对象和真正执行循环被拆成两层。" },
      { file: "packages/agent-core/src/agent-loop.ts", symbol: "runLoop / executeToolCalls", note: "核心文件显式区分顺序与并行工具、结果最终化、steering 和继续下一模型 turn 的条件。" },
    ],
  },
  O03: {
    architecture: "run-orchestrator 准备并协调多次 attempt；run/attempt.ts 把 prepared runtime、工具、系统提示、transcript 与 core loop 连接，并在 overflow 等失败后恢复。",
    evidence: [
      { file: "src/agents/embedded-agent-runner/run.ts", symbol: "runEmbeddedAgent", note: "公开入口负责接收产品级参数并交给 orchestrator，不把所有准备逻辑塞进一个函数。" },
      { file: "src/agents/embedded-agent-runner/run/attempt.ts", symbol: "runEmbeddedAttempt", note: "一次 attempt 的 session、model、tools、hook 与 stream 装配在这里形成清楚的失败边界。" },
    ],
  },
  O04: {
    architecture: "Gateway 启动长期服务；channel receive 将外部消息放入可靠 ingress，run-channel-turn 处理一次渠道轮次，durable delivery 再拥有出站交付。",
    evidence: [
      { file: "src/gateway/server-start.ts", symbol: "startGatewayServer", note: "Gateway 入口创建服务器与运行时服务，说明它是控制平面而不是模型循环实现。" },
      { file: "src/channels/turn/run-channel-turn.ts", symbol: "runChannelTurn", note: "一轮渠道消息的 prepared lifecycle、Agent 运行和最终投递在这里串联并分别保留结果。" },
    ],
  },
  O05: {
    architecture: "resolve-route 根据 channel、account、peer、thread 与 binding scope 解析 agentId；session-key 将结果稳定编码成会话身份和连续性边界。",
    evidence: [
      { file: "src/routing/resolve-route.ts", symbol: "resolveAgentRoute", note: "从绑定匹配优先级可以确认指定 peer、账号或渠道如何覆盖默认 Agent。" },
      { file: "src/routing/session-key.ts", symbol: "session key builders", note: "会话键把 Agent、渠道与对话范围编码在一起，防止不同用户或线程共享历史。" },
    ],
  },
  O06: {
    architecture: "PreparedModelRuntimeGeneration 原子持有 auth template、model registry 与 catalog；Gateway 发布完整世代，Agent run 从它 fork 可变 store。",
    evidence: [
      { file: "src/agents/prepared-model-runtime.ts", symbol: "prepared model runtime publication", note: "读取 build、publish 与 lookup 路径，能看到未完成 generation 不会成为读者可见状态。" },
      { file: "src/agents/prepared-model-runtime.build.ts", symbol: "buildPreparedModelRuntime", note: "认证发现、registry 和投影 catalog 在同一次构建中完成，形成一致快照。" },
    ],
  },
  O07: {
    architecture: "agent-tools.ts 定义产品工具 surface；agent-core 执行工具批次；effective policy、result middleware 与 compaction hook 分别控制准入、结果和预算。",
    evidence: [
      { file: "src/agents/agent-tools.ts", symbol: "buildAgentTools", note: "工具构建按 Agent、渠道与沙箱上下文选择能力，并保留 policy 注入位置。" },
      { file: "src/agents/agent-hooks/compaction-safeguard.ts", symbol: "compaction safeguard", note: "压缩保护在标准 Hook 位置检查上下文和 session，而不是侵入每一种 provider 或工具。" },
    ],
  },
  O08: {
    architecture: "ResourceLoader 发现 prompts、skills、themes 与 extensions；Harness registry 记录内置和插件 runtime；selection policy 决定一次请求实际交给谁执行。",
    evidence: [
      { file: "src/agents/sessions/resource-loader.ts", symbol: "DefaultResourceLoader", note: "manifest 与约定目录的发现、覆盖和重载集中在资源层，不散落在 Agent Loop。" },
      { file: "src/agents/harness/selection.ts", symbol: "selectAgentHarness / runAgentHarnessAttempt", note: "选择逻辑结合 provider route、配置与插件支持度，再通过统一接口运行 attempt。" },
    ],
  },
  N01: {
    architecture: "Channel 只做外部协议与统一消息之间的翻译；MessageBus 是跨层边界，AgentLoop 只消费 InboundMessage，并把结果重新交回 OutboundMessage。",
    evidence: [
      { file: "nanobot/bus/events.py", symbol: "InboundMessage / OutboundMessage", note: "先看两个事件的数据字段，可以确认渠道名、会话与回复目标如何被统一表达。" },
      { file: "nanobot/bus/queue.py", symbol: "MessageBus", note: "再追入站与出站队列的 publish / consume 方法，验证渠道和 Agent 并不直接互调。" },
    ],
  },
  N02: {
    architecture: "AgentLoop 拥有渠道侧的一轮对话，AgentRunner 拥有模型侧的多次迭代；二者以一次运行所需的消息、工具和限制作为交接面。",
    evidence: [
      { file: "nanobot/agent/loop.py", symbol: "AgentLoop", note: "这里能看到 session key、workspace、context 与 outbound delivery 被放在同一轮次编排中。" },
      { file: "nanobot/agent/runner.py", symbol: "AgentRunner", note: "这里集中处理 provider stream、tool call、tool result 与迭代停止条件。" },
    ],
  },
  N03: {
    architecture: "项目规则、人格、记忆、技能和本轮请求先保持来源独立，再由 ContextBuilder 按顺序投影成模型消息；Runner 只接收投影结果。",
    evidence: [
      { file: "nanobot/agent/context.py", symbol: "ContextBuilder", note: "沿 build 路径查看各类上下文块的装配顺序，以及最终如何形成 model-visible messages。" },
      { file: "nanobot/runtime_context.py", symbol: "RuntimeContext", note: "对照运行时元数据与持久消息，能看出哪些字段只用于本轮执行、不会混进历史。" },
    ],
  },
  N04: {
    architecture: "AgentRunner 依赖稳定的 Provider 契约；具体厂商的鉴权、请求格式、流式块和 reasoning 差异被压在实现层与 registry 里。",
    evidence: [
      { file: "nanobot/providers/base.py", symbol: "LLMProvider", note: "先读基类的统一输入输出，确认核心循环真正依赖的最小模型协议。" },
      { file: "nanobot/providers/registry.py", symbol: "provider registry", note: "再看模型名、配置与 provider 实现如何匹配，验证选择策略没有散落到 AgentLoop。" },
    ],
  },
  N05: {
    architecture: "ToolRegistry 位于模型 schema 与运行时 handler 之间：向上提供可调用能力描述，向下负责查找、校验与执行。MCP 只是其中一种工具来源。",
    evidence: [
      { file: "nanobot/agent/tools/base.py", symbol: "Tool", note: "工具基类把 name、description、parameters 与 execute 放在同一契约中。" },
      { file: "nanobot/agent/tools/registry.py", symbol: "ToolRegistry", note: "注册、schema 汇总与按名称执行的路径，证明 Runner 无需认识每一种具体工具。" },
    ],
  },
  N06: {
    architecture: "Session 保存可恢复的事实，Context Governance 决定本轮可见窗口，Auto Compact 在预算越界时追加摘要；存储与模型视图不是同一个对象。",
    evidence: [
      { file: "nanobot/session/manager.py", symbol: "SessionManager", note: "从 load、append 与 save 路径确认历史如何持久化，以及 session key 如何隔离对话。" },
      { file: "nanobot/agent/autocompact.py", symbol: "auto compaction", note: "查看 token 阈值、保留后缀与摘要写回位置，能验证压缩发生在上下文治理边界。" },
    ],
  },
  N07: {
    architecture: "短期会话先产生候选事实，Dream / memory 层再把稳定信息写入长期 Markdown；下一轮由 ContextBuilder 重新读取，而不是直接复用旧 prompt。",
    evidence: [
      { file: "nanobot/agent/memory.py", symbol: "MemoryStore / consolidation", note: "关注 read、write、history 与 consolidation 路径，区分原始历史和长期记忆。" },
      { file: "nanobot/templates/SOUL.md", symbol: "SOUL template", note: "它与 USER.md 一起说明人格和用户事实以可检查文本进入上下文，而非隐藏状态。" },
    ],
  },
  N08: {
    architecture: "Gateway 是 composition root：创建渠道、API、Cron、AgentLoop 等长期服务并统一关闭；它拥有基础设施生命周期，但不实现模型推理。",
    evidence: [
      { file: "nanobot/cli/gateway.py", symbol: "gateway startup", note: "从启动函数顺着 service construction 与 cleanup 读，可以看到所有长期组件的组装顺序。" },
      { file: "nanobot/channels/manager.py", symbol: "ChannelManager", note: "渠道的发现、启动、停止与消息投递集中于此，不会侵入 AgentRunner。" },
    ],
  },
  D01: {
    architecture: "Cordis Context 既是插件树的挂载点，也是服务与事件的作用域；插件注册的 effect 会随 scope 一起回收，因此扩展天然可撤销。",
    evidence: [
      { file: "vendor/cordis", symbol: "Context / EffectScope", note: "从 provide、on、effect 与 dispose 的实现关系，可以验证服务、监听器和清理函数共享生命周期。" },
      { file: "packages/core/agent", symbol: "agent plugin", note: "核心 Agent 同样通过插件安装到 ctx，说明它不是绕过 Cordis 的特权单例。" },
    ],
  },
  D02: {
    architecture: "Profile 选择产品形态，Bundle 展开一组插件，patch 按稳定 id 覆盖节点；最终运行时由一棵有序配置树生成。",
    evidence: [
      { file: "packages/bundle/base", symbol: "base bundle", note: "查看 bundle 导出的插件清单，可以看到基础能力本身也是可替换的组合。" },
      { file: "packages/boot/app-boot", symbol: "profile resolution", note: "沿 profile、bundle、patch 的加载顺序，确认覆盖发生在插件启动之前。" },
    ],
  },
  D03: {
    architecture: "SessionEvent 日志是事实层；模型 messages、UI trajectory、fork 与 transcript 都是从同一日志派生的投影，因此不需要同步多份可变状态。",
    evidence: [
      { file: "packages/core/session", symbol: "SessionEvent / append", note: "关注事件联合类型与 append 路径，确认旧事件不被原地改写。" },
      { file: "packages/client/ui-trajectory", symbol: "trajectory projection", note: "UI 从事件重建可见轨迹，证明渲染层没有维护另一套会话真源。" },
    ],
  },
  D04: {
    architecture: "Turn 是用户意图的工作边界，Step 是一次模型请求及其工具回填。生命周期事件把二者暴露给权限、UI、遥测与续跑插件。",
    evidence: [
      { file: "packages/core/agent-loop", symbol: "turn / step lifecycle", note: "按 turn/start、step/start、step/end、turn/end 的发射位置追读，可看到循环的真实停止边界。" },
      { file: "packages/core/agent", symbol: "input inbox", note: "查看输入 claim、steering 与 follow-up 状态，理解为什么一次 step 结束不一定结束 turn。" },
    ],
  },
  D05: {
    architecture: "工具只声明能力与执行者；pre / execute / post 的 waterfall 管线拥有审批、沙箱、超时、替换结果等横切策略。",
    evidence: [
      { file: "packages/core/tools", symbol: "tools/pre-execute", note: "查看调用事件和 waterfall 返回值，确认前置插件可以阻止或改写一次执行。" },
      { file: "packages/guard", symbol: "guard plugin", note: "Guard 作为管线消费者接入，而不是修改每个 tool handler，体现策略与能力分离。" },
    ],
  },
  D06: {
    architecture: "Seam 由 definition、provider、consumer 三部分构成；Scope 负责为当前 agent 选择最具体的 provider，使整组消费者同时切换执行世界。",
    evidence: [
      { file: "packages/core/scope", symbol: "scoped service resolution", note: "沿服务注册与查找规则查看 shadow 行为，确认局部 provider 可以覆盖全局实现。" },
      { file: "packages/fs/fs", symbol: "filesystem provider", note: "文件工具依赖统一 fs seam；替换 provider 后，上层 editor 与读取工具无需改代码。" },
    ],
  },
  D07: {
    architecture: "Compaction、Jobs 与 Goal 各自拥有状态机，只在标准事件点把摘要、完成事实或续跑请求重新注入 Agent；主循环不理解其内部细节。",
    evidence: [
      { file: "packages/compaction", symbol: "compaction events", note: "查看压缩结果如何作为 session 事件写回，而不是直接篡改 AgentLoop 的 messages。" },
      { file: "packages/jobs", symbol: "job completion injection", note: "后台任务完成后通过统一输入/事件回流，验证 jobs 不需要占住当前 turn。" },
    ],
  },
  D08: {
    architecture: "Web 与 Headless 是两套 surface bundle，下面共享 session、tools、llm 与 agent-loop；Trajectory 则把同一 SessionEvent 投影成可观察过程。",
    evidence: [
      { file: "packages/bundle/web-app", symbol: "web bundle", note: "检查它额外装入的服务器与 UI 插件，区分产品表面和共享内核。" },
      { file: "packages/bundle/headless", symbol: "headless bundle", note: "对照 headless 的更小插件集合，可验证无服务器运行并不是另一套 Agent。" },
    ],
  },
  P01: {
    architecture: "pi-ai 定义模型协议，pi-agent-core 提供状态循环，pi-coding-agent 负责会话与产品策略，pi-tui 只处理终端输入输出；依赖方向由外向内单向收敛。",
    evidence: [
      { file: "packages/ai/src", symbol: "provider primitives", note: "从公开类型与 provider exports 可以确认最底层只描述模型、消息、工具和流事件。" },
      { file: "packages/agent/src", symbol: "agent runtime exports", note: "这一层依赖 pi-ai，却不依赖 coding-agent 或 TUI，体现核心包的可复用边界。" },
    ],
  },
  P02: {
    architecture: "每个 provider adapter 把厂商响应转换成统一 AssistantMessageEvent 流；上层 Agent 只消费 start、delta、toolcall、done、error 等稳定词汇。",
    evidence: [
      { file: "packages/ai/src/types.ts", symbol: "AssistantMessageEvent", note: "先读事件联合类型，明确流式文本、思考、工具调用和结束原因的公共表示。" },
      { file: "packages/ai/src/providers", symbol: "provider adapters", note: "任选两个厂商实现对照，能看到差异在这里被转换，而不是泄漏到 agent-loop。" },
    ],
  },
  P03: {
    architecture: "Agent 类拥有可观察状态与 prompt 入口，agent-loop.ts 执行 turn：请求模型、收集流、调工具、追加结果，并判断是否还欠一次模型调用。",
    evidence: [
      { file: "packages/agent/src/agent.ts", symbol: "Agent.prompt / state", note: "查看 prompt 如何进入运行循环，以及状态与事件如何暴露给上层 session。" },
      { file: "packages/agent/src/agent-loop.ts", symbol: "agentLoop", note: "沿 assistant stream 到 tool execution 再回到下一 turn 的分支，可找到核心 while 的退出条件。" },
    ],
  },
  P04: {
    architecture: "transformContext 先处理业务级 AgentMessage，convertToLlm 再降级成 provider 消息；持久化格式、UI 消息与厂商协议因此可以独立演进。",
    evidence: [
      { file: "packages/agent/src/types.ts", symbol: "AgentMessage / transformContext", note: "类型层允许自定义消息存在于 Agent 历史中，并明确转换函数的扩展位置。" },
      { file: "packages/coding-agent/src/core/messages.ts", symbol: "convertToLlm", note: "这里决定哪些 coding-agent 消息进入模型、如何转换，哪些只留给 UI 与会话。" },
    ],
  },
  P05: {
    architecture: "Agent loop 是工具调度器：先过 beforeToolCall，再依据 sequential 标记安排并发，执行后交给 afterToolCall 改写结果或提前终止。",
    evidence: [
      { file: "packages/agent/src/agent-loop.ts", symbol: "executeToolCalls", note: "追踪工具数组的分组与 await 方式，可以验证顺序工具如何形成并发屏障。" },
      { file: "packages/agent/src/types.ts", symbol: "beforeToolCall / afterToolCall", note: "钩子的返回类型定义了 block、override 与 terminate，而不是靠约定字符串。" },
    ],
  },
  P06: {
    architecture: "AgentSession 位于 core Agent 与 CLI/RPC/TUI 之间，拥有会话、队列、资源和事件桥接；UI 可以操控运行，但不需要接管模型循环。",
    evidence: [
      { file: "packages/coding-agent/src/core/agent-session.ts", symbol: "AgentSession", note: "从 prompt、queueSteering、queueFollowUp 与 waitForIdle 看完整的产品级控制面。" },
      { file: "packages/coding-agent/src/core/agent-session-runtime.ts", symbol: "session runtime", note: "运行时对象集中注入 model、tools、resources 与 session manager，避免构造逻辑散在各入口。" },
    ],
  },
  P07: {
    architecture: "JSONL 每行是带 id 与 parentId 的节点，当前 leaf 决定可见分支；fork 只改变后续父节点，旧分支仍可回放、总结或再次进入。",
    evidence: [
      { file: "packages/coding-agent/src/core/session-manager.ts", symbol: "append / branch / leaf", note: "查看节点追加与当前 leaf 更新逻辑，确认 fork 不需要复制整份会话文件。" },
      { file: "packages/coding-agent/docs/session-format.md", symbol: "JSONL entry schema", note: "格式文档明确各类 entry 与 parentId 关系，是理解树结构最直接的证据。" },
    ],
  },
  P08: {
    architecture: "ResourceLoader 负责发现与合并资源，ExtensionAPI 把工具、事件、命令、快捷键和 UI 注册到 AgentSession；/reload 重建外围能力而保留核心。",
    evidence: [
      { file: "packages/coding-agent/src/core/resource-loader.ts", symbol: "DefaultResourceLoader", note: "沿 global、project 与 package 的加载优先级，确认资源覆盖规则与错误收集方式。" },
      { file: "packages/coding-agent/src/core/extensions", symbol: "ExtensionAPI", note: "注册方法与生命周期上下文展示了扩展如何进入 session，而不修改 agent-core。" },
    ],
  },
};

const projects = {
  dsh: {
    title: "拆解 DeepSeek Harness",
    label: "DSH",
    accent: "#4f8df7",
    intro: "一个把模型、工具、会话、循环和 UI 全部做成插件的 Agent Harness，如何靠 Cordis 组合成产品。",
    repo: "https://github.com/deepseek-ai/deepseek-harness",
    branch: "master",
    language: "TypeScript · Cordis",
    lessons: dshLessons,
  },
  pi: {
    title: "拆解 PI Agent",
    label: "PI Agent",
    accent: "#ef684c",
    intro: "一个极简终端 Coding Harness，如何用分层包、会话树与扩展系统，把工作流选择权交还给使用者。",
    repo: "https://github.com/badlogic/pi-mono",
    branch: "main",
    language: "TypeScript · TUI",
    lessons: piLessons,
  },
  nanobot: {
    title: "拆解 nanobot",
    label: "nanobot",
    accent: "#ffb11b",
    intro: "一只很轻的个人 Agent，如何从消息总线一路长成多渠道、可记忆、可持续运行的产品。",
    repo: "https://github.com/HKUDS/nanobot",
    branch: "main",
    language: "Python · React",
    lessons: nanobotLessons,
  },
  claude: {
    title: "拆解 Claude Code",
    label: "Claude Code",
    accent: "#d97757",
    intro: "基于 Anthropic 官方公开的 Agent SDK、插件与 Hook 源码，拆解 Claude Code 可验证的控制协议与运行边界。",
    repo: "https://github.com/anthropics/claude-agent-sdk-python",
    branch: "main",
    language: "Python · SDK / CLI",
    lessons: claudeLessons,
  },
  openclaw: {
    title: "拆解 OpenClaw",
    label: "OpenClaw",
    accent: "#17a589",
    intro: "一个跨渠道个人 AI 助手，如何用 Gateway、Harness、Runner、agent-core 与插件 SDK 组成生产级运行时。",
    repo: "https://github.com/openclaw/openclaw",
    branch: "main",
    language: "TypeScript · Gateway",
    lessons: openclawLessons,
  },
} as const;

const courseOverviews: Record<ProjectKey, CourseOverviewData> = {
  dsh: {
    eyebrow: "ROUTE A · COMPOSABLE HARNESS",
    headline: "如果 Agent 的骨架也能随时替换，会发生什么？",
    thesis: "DSH 的核心设计不是“多做几个插件”，而是把模型、工具、会话、循环与产品入口都放进同一棵可组合、可撤销的插件树。",
    tension: "普通框架通常先造一个稳定核心，再给外围留扩展点；DSH 反过来问：为什么核心本身不能也是插件？",
    principles: [
      { title: "一切能力都可组合", detail: "模型、工具、Session、Agent Loop 和 UI 没有谁拥有永久特权，它们都通过 ctx 安装和协作。" },
      { title: "副作用必须能撤回", detail: "监听器、服务与资源跟随 scope 生命周期；卸载插件时，它留下的行为也应该一起消失。" },
      { title: "产品是一棵配置树", detail: "Profile 选择形态，Bundle 展开能力，patch 精确覆盖节点；Web 与 Headless 只是不同组合。" },
    ],
    journey: ["Surface", "Profile / Bundle", "Context", "Agent Loop", "LLM / Tools", "SessionEvent"],
    questions: [
      { question: "所有东西都是插件，启动顺序会不会失控？", answer: "Profile、Bundle 与稳定 id 把组合顺序显式化；Cordis scope 再负责生命周期与回收。" },
      { question: "为什么会话真源不是 messages 数组？", answer: "messages 只是模型视图；追加式 SessionEvent 才能同时支持回放、分支、UI 轨迹与审计。" },
      { question: "换一个沙箱，为什么不必重写所有工具？", answer: "工具消费统一 seam；在局部 scope 替换 provider，就能让整组消费者进入新的执行世界。" },
    ],
    bestFor: ["需要多产品形态共享同一内核", "需要替换模型、文件系统或执行环境", "重视生命周期、审计与可恢复性"],
    tradeoffs: ["抽象密度高，初读源码不如线性调用直接", "插件顺序与作用域需要严格设计", "小项目可能暂时用不到全部组合能力"],
  },
  pi: {
    eyebrow: "ROUTE B · MINIMAL AGENT CORE",
    headline: "如果核心只保留循环，工作流应该放在哪里？",
    thesis: "PI Agent 把 Agent core 压到最小：核心负责状态与工具循环，模型差异、会话策略、资源发现和终端体验全部留给外围层与扩展。",
    tension: "很多 Coding Agent 把审批、计划、子任务和 UI 策略写进核心；PI 选择克制，让使用者与扩展决定“Agent 应该怎样工作”。",
    principles: [
      { title: "核心只承诺生命周期", detail: "Agent core 处理 prompt、流事件、tool call 和停止条件，但不替上层决定完整产品工作流。" },
      { title: "模型先统一成事件流", detail: "不同厂商先被 pi-ai 翻译成稳定词汇，上层只消费 start、delta、toolcall、done 与 error。" },
      { title: "会话与扩展属于产品层", detail: "AgentSession、JSONL tree 与 ExtensionAPI 共同提供可操控、可分支、可重载的使用体验。" },
    ],
    journey: ["CLI / SDK", "AgentSession", "Agent Core", "pi-ai Stream", "Tool Hooks", "JSONL Branch"],
    questions: [
      { question: "一个很小的 Agent core，为什么仍能长成功能完整的 Coding Agent？", answer: "外围 AgentSession 持有资源、队列与会话，ExtensionAPI 再把工具、命令、事件和 UI 挂进来。" },
      { question: "用户在 Agent 运行中继续输入，会打断还是排队？", answer: "steering 与 follow-up 是两种明确队列语义，决定新消息在当前循环的哪个边界介入。" },
      { question: "为什么 JSONL 能同时表示历史和分支？", answer: "每行节点记录 id 与 parentId，当前 leaf 选择可见路径；创建分支无需复制整份会话。" },
    ],
    bestFor: ["希望完全掌控 Coding Agent 工作流", "需要接入多模型与自定义消息", "喜欢小内核、强扩展和可读会话文件"],
    tradeoffs: ["许多产品策略需要使用者自己选择", "外围扩展多时要管理好约定与资源优先级", "极简核心不会自动替你提供完整平台能力"],
  },
  nanobot: {
    eyebrow: "ROUTE C · READABLE APPLICATION",
    headline: "一个轻量 Agent，怎样避免长成一团大循环？",
    thesis: "nanobot 的核心价值是清晰分层：Channel 翻译外部协议，MessageBus 解耦入口，ContextBuilder 组装世界，Runner 执行模型与工具，Gateway 拥有长期服务。",
    tension: "轻量项目最容易把渠道、Prompt、模型、工具和记忆塞进同一个文件；nanobot 展示了如何保持调用链短，同时不牺牲产品边界。",
    principles: [
      { title: "先统一消息，再接渠道", detail: "飞书、终端或 Web 都先变成 InboundMessage；Agent 不需要知道消息原本来自哪里。" },
      { title: "编排与执行分两层", detail: "AgentLoop 管一轮产品交互，AgentRunner 管模型—工具迭代，路由问题和推理问题因此容易分开排查。" },
      { title: "长期服务由 Gateway 拥有", detail: "Channel、API、Cron 与 Memory 有明确启动和关闭位置，AgentRunner 不会被基础设施职责污染。" },
    ],
    journey: ["Channel", "MessageBus", "ContextBuilder", "AgentRunner", "Provider / Tools", "Delivery / Memory"],
    questions: [
      { question: "为什么 Channel 不直接调用 Agent？", answer: "异步 MessageBus 把渠道生命周期与推理解耦，同一 Agent 才能被多个入口复用。" },
      { question: "ContextBuilder 和 Session 有什么区别？", answer: "Session 保存事实；ContextBuilder 决定本轮从人格、项目、记忆与历史中取哪些材料给模型看。" },
      { question: "长期记忆为什么不能等于完整聊天记录？", answer: "原始历史噪声大且成本高；Dream 只把稳定事实和可复用流程沉淀为可检查的长期知识。" },
    ],
    bestFor: ["第一次系统阅读个人 Agent 源码", "希望快速追通消息到回复的调用链", "需要多渠道、记忆与定时任务的轻量产品"],
    tradeoffs: ["组合自由度不如 DSH 的插件树彻底", "工作流可塑性不如 PI 的扩展面开放", "规模继续增长时需要防止 Gateway 与配置层变重"],
  },
  claude: {
    eyebrow: "ROUTE D · PUBLIC SDK BOUNDARY",
    headline: "Claude Code 没有完整开源，我们仍然能从官方源码看懂什么？",
    thesis: "官方 Agent SDK 没有复刻 Claude Code 的内部循环，而是把双向控制、类型化消息、权限、Hook、会话与插件暴露成稳定接口；它展示的是一条可验证的运行边界。",
    tension: "Anthropic 的 claude-code 仓库公开插件、示例与配置，但不包含完整核心实现；这条路线因此只分析官方公开 SDK 与接口，不使用反编译或泄漏材料。",
    principles: [
      { title: "CLI 是明确的进程边界", detail: "Python 应用通过 SubprocessCLITransport 启动官方 CLI，以 JSON 流通信；SDK 负责控制，核心运行时仍留在 CLI 侧。" },
      { title: "生命周期先变成类型", detail: "Assistant、User、System、Result 与 StreamEvent 组成消息联合类型，让调用者能按阶段处理运行过程，而不是解析模糊文本。" },
      { title: "安全控制是一等协议", detail: "权限回调、Hook、MCP 工具与控制请求都沿同一双向通道工作，审批和拦截不必偷偷塞进 Prompt。" },
    ],
    journey: ["Python App", "ClaudeSDKClient", "Control / Query", "Subprocess Transport", "Claude Code CLI", "Typed Events"],
    questions: [
      { question: "SDK 为什么同时提供 query() 与 ClaudeSDKClient？", answer: "query() 适合一次性单向请求；ClaudeSDKClient 维护双向控制通道，能在运行中发送输入、处理中断、权限和 Hook。" },
      { question: "自定义 MCP 工具在哪里真正执行？", answer: "@tool 与 create_sdk_mcp_server 在 Python 进程内建立 SDK MCP server；CLI 通过控制协议发来调用，SDK 再执行处理函数并回传结果。" },
      { question: "课程为什么不讲 Claude Code 内部 Agent Loop 的逐行源码？", answer: "因为完整核心没有在官方仓库公开。课程只把官方能验证的 SDK、插件、Hook 与协议边界讲透。" },
    ],
    bestFor: ["需要可靠集成 Claude Code 能力", "关心权限、Hook 与双向控制", "想学习 SDK 如何包住一个独立 Agent 运行时"],
    tradeoffs: ["无法逐行审计 Claude Code 内部核心循环", "运行仍依赖官方 CLI", "理解重点是控制面与公开接口，而非完整实现复刻"],
  },
  openclaw: {
    eyebrow: "ROUTE E · PERSONAL AGENT OS",
    headline: "为什么 OpenClaw 更像 Agent 操作系统，而不是聊天机器人？",
    thesis: "OpenClaw 把渠道接入、Gateway 控制面、路由、Harness 选择、Runner 尝试循环、agent-core 与会话持久化拆成不同层，让一个 Agent 能跨入口、跨模型、跨插件长期运行。",
    tension: "一个聊天循环很容易写；难的是同时管理多个渠道、多个 Agent、配置刷新、工具策略、会话恢复与插件兼容，而不让所有职责挤进同一个进程入口。",
    principles: [
      { title: "控制平面与执行循环分开", detail: "Gateway 接收连接和命令，routing 决定会话归属，embedded runner 才负责一次真正的模型—工具尝试。" },
      { title: "准备态运行时按代际发布", detail: "模型、工具和配置先构建为 prepared runtime；新请求切到新 generation，正在运行的任务不被热更新撕裂。" },
      { title: "Harness 与插件都有稳定边界", detail: "harness registry 选择运行方式，plugin-sdk 暴露受支持的契约，扩展不需要穿透整个 src 内部结构。" },
    ],
    journey: ["Channel", "Gateway / Routing", "Harness", "Embedded Runner", "agent-core", "Delivery / Session"],
    questions: [
      { question: "为什么消息不能从 Channel 直接进入 Agent Loop？", answer: "Gateway 和 routing 先处理连接、身份、Agent 选择与 session key，执行层才能面对一个稳定、已归属的请求。" },
      { question: "配置或模型刷新时，正在跑的任务怎么办？", answer: "prepared runtime 用 generation 隔离新旧运行时；旧任务持有自己的 lease，完成后再释放旧资源。" },
      { question: "OpenClaw 为什么同时需要 agent-core、runner 和 harness？", answer: "agent-core 放可复用原语，runner 管内建尝试循环，harness 决定采用哪套运行实现；三个层次解决不同变化速度。" },
    ],
    bestFor: ["研究跨渠道个人 Agent 产品", "学习生产级控制面与运行时隔离", "需要多 Agent 路由、会话和插件生态"],
    tradeoffs: ["系统规模与阅读面最广", "Gateway、Harness、Runner 的层级需要先建立全局地图", "部署与配置复杂度高于单进程轻量 Agent"],
  },
};

const architectureComparison = [
  { key: "dsh" as const, name: "DSH", belief: "边界必须可替换", strength: "插件组合与能力换骨", cost: "抽象密度最高" },
  { key: "pi" as const, name: "PI Agent", belief: "核心应该尽可能小", strength: "工作流可塑与会话分支", cost: "产品策略需要自己选择" },
  { key: "nanobot" as const, name: "nanobot", belief: "调用链应该直接可读", strength: "清晰分层与快速上手", cost: "组合自由度相对克制" },
  { key: "claude" as const, name: "Claude Code", belief: "运行能力通过稳定控制协议暴露", strength: "成熟工具体验与安全边界", cost: "核心实现并未完整开源" },
  { key: "openclaw" as const, name: "OpenClaw", belief: "个人 Agent 需要完整控制平面", strength: "跨渠道、运行时与插件生态", cost: "系统与运维复杂度最高" },
];

function routeFromHash(): RouteKey {
  if (typeof window === "undefined") return "home";
  const route = window.location.hash.replace("#/", "").split("/")[0];
  if (route === "dsh" || route === "pi" || route === "nanobot" || route === "claude" || route === "openclaw" || route === "compare") return route;
  return "home";
}

export default function Home() {
  const [route, setRoute] = useState<RouteKey>("home");
  const [lessonId, setLessonId] = useState<Record<ProjectKey, string | null>>({ dsh: null, pi: null, nanobot: null, claude: null, openclaw: null });
  const [tab, setTab] = useState<"lecture" | "source">("lecture");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = routeFromHash();
      setRoute(next);
      const bits = window.location.hash.replace("#/", "").split("/");
      if (next === "dsh" || next === "pi" || next === "nanobot" || next === "claude" || next === "openclaw") {
        const valid = bits[1] && projects[next].lessons.some((lesson) => lesson.id === bits[1]);
        setLessonId((current) => ({ ...current, [next]: valid ? bits[1] : null }));
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

  const showOverview = (project: ProjectKey) => {
    setLessonId((current) => ({ ...current, [project]: null }));
    window.location.hash = `#/${project}`;
  };

  return (
    <div className="site-shell">
      <Header route={route} navigate={navigate} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      {route === "home" && <Landing navigate={navigate} />}
      {(route === "dsh" || route === "pi" || route === "nanobot" || route === "claude" || route === "openclaw") && (
        <CoursePage
          projectKey={route}
          selectedId={lessonId[route]}
          selectLesson={selectLesson}
          showOverview={showOverview}
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
  const sourceRepo = "https://github.com/yu-xin-c/agent-unpacked";

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
        <span className="brand-copy">
          <span className="brand-name">agent-unpacked</span>
          <span className="brand-sub">来自于 Stellar鱼 的教程</span>
        </span>
      </button>
      <button className="mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <nav className={menuOpen ? "topnav open" : "topnav"} aria-label="主导航">
        {([
          ["home", "学习入口"],
          ["dsh", "拆 DSH"],
          ["pi", "拆 PI"],
          ["nanobot", "拆 nanobot"],
          ["claude", "拆 Claude"],
          ["openclaw", "拆 OpenClaw"],
          ["compare", "横向对照"],
        ] as [RouteKey, string][]).map(([key, label]) => (
          <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>
        ))}
        <a className="github-button" href={sourceRepo} target="_blank" rel="noreferrer" aria-label="查看 Stellar鱼 教程 GitHub">GH</a>
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
          <p>五条源码路线，一套统一问题：消息怎么进来、上下文怎么组装、模型如何调用工具、状态如何留下、系统如何长成产品。</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => navigate("dsh")}>从 DSH 开始 <span>→</span></button>
            <button className="text-action" onClick={() => navigate("compare")}>先看五种架构差异</button>
          </div>
          <div className="hero-stats">
            <div><strong>40</strong><span>节架构课</span></div>
            <div><strong>5</strong><span>源码路线</span></div>
            <div><strong>1</strong><span>统一心智模型</span></div>
          </div>
        </div>
        <SystemSketch />
      </section>

      <section className="route-section">
        <div className="section-heading">
          <span>选择一条路线</span>
          <p>五个项目从同一个 Agent 问题出发，给出插件组合、极简扩展、应用分层、控制协议与个人 Agent OS 五种答案。</p>
        </div>
        <div className="route-cards">
          <RouteCard project="dsh" navigate={navigate} />
          <RouteCard project="pi" navigate={navigate} />
          <RouteCard project="nanobot" navigate={navigate} />
          <RouteCard project="claude" navigate={navigate} />
          <RouteCard project="openclaw" navigate={navigate} />
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
  const routeIndex: Record<ProjectKey, string> = { dsh: "ROUTE A", pi: "ROUTE B", nanobot: "ROUTE C", claude: "ROUTE D", openclaw: "ROUTE E" };
  const routeIcon: Record<ProjectKey, string> = { dsh: "dsh / core", pi: "pi / agent", nanobot: "nano / bot", claude: "claude / sdk", openclaw: "open / claw" };
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
  showOverview,
  tab,
  setTab,
}: {
  projectKey: ProjectKey;
  selectedId: string | null;
  selectLesson: (project: ProjectKey, id: string) => void;
  showOverview: (project: ProjectKey) => void;
  tab: "lecture" | "source";
  setTab: (tab: "lecture" | "source") => void;
}) {
  const data = projects[projectKey];
  const lesson = selectedId ? data.lessons.find((item) => item.id === selectedId) ?? null : null;
  const index = lesson ? data.lessons.findIndex((item) => item.id === lesson.id) : -1;
  const groups = useMemo(() => [...new Set(data.lessons.map((item) => item.group))], [data.lessons]);

  return (
    <div className="course-layout">
      <aside className="course-sidebar">
        <div className="course-identity">
          <small>当前路线</small>
          <strong>{data.title}</strong>
          <span>{data.language}</span>
        </div>
        <button className={`overview-nav-button ${lesson ? "" : "selected"}`} onClick={() => showOverview(projectKey)}>
          <span>00</span><b>路线总览 · 先看全局</b>
        </button>
        <nav aria-label={`${data.label} 课程目录`}>
          {groups.map((group) => {
            const lessons = data.lessons.filter((item) => item.group === group);
            return (
              <div className="lesson-group" key={group}>
                <div className="group-name"><i style={{ background: lessons[0].groupColor }} />{group}</div>
                {lessons.map((item) => (
                  <button key={item.id} className={item.id === lesson?.id ? "selected" : ""} onClick={() => selectLesson(projectKey, item.id)}>
                    <span>{item.id}</span><b>{item.title.split("：")[0]}</b>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <a href={data.repo} target="_blank" rel="noreferrer" className="repo-link">查看官方源码 <span>↗</span></a>
      </aside>

      <main className={`lesson-main ${lesson ? "" : "course-overview-main"}`}>
        {lesson ? (
          <>
            <div className="breadcrumbs"><span>学习路径</span><i>/</i><span>{lesson.group}</span><i>/</i><b>{lesson.id}</b></div>
            <div className="lesson-kicker"><span>{lesson.id}</span>{lesson.kicker}</div>
            <h1>{lesson.title}</h1>
            <blockquote style={{ borderColor: lesson.groupColor }}>{lesson.motto}</blockquote>

            <div className="lesson-tabs">
              <button className={tab === "lecture" ? "active" : ""} onClick={() => setTab("lecture")}>讲义</button>
              <button className={tab === "source" ? "active" : ""} onClick={() => setTab("source")}>源码地图 <span>{lesson.files.length}</span></button>
            </div>

            {tab === "lecture" ? <Lecture lesson={lesson} project={projectKey} /> : <SourceMap lesson={lesson} project={projectKey} />}

            <div className="lesson-pagination">
              <button onClick={() => index === 0 ? showOverview(projectKey) : selectLesson(projectKey, data.lessons[index - 1].id)}>
                <span>← {index === 0 ? "路线总览" : "上一课"}</span><b>{index === 0 ? "回到全局设计" : data.lessons[index - 1].title}</b>
              </button>
              <button className="next" disabled={index === data.lessons.length - 1} onClick={() => selectLesson(projectKey, data.lessons[index + 1]?.id)}>
                <span>下一课 →</span><b>{data.lessons[index + 1]?.title ?? "路线完成"}</b>
              </button>
            </div>
          </>
        ) : (
          <CourseOverview project={projectKey} selectLesson={selectLesson} />
        )}
      </main>

      <aside className="lesson-rail">
        {lesson ? (
          <>
            <div className="rail-progress"><span>路线进度</span><b>{String(index + 1).padStart(2, "0")} / {String(data.lessons.length).padStart(2, "0")}</b><i><em style={{ width: `${((index + 1) / data.lessons.length) * 100}%`, background: data.accent }} /></i></div>
            <div className="rail-toc"><span>本页</span><a href="#start">小白导读</a><a href="#terms">先认术语</a><a href="#flow">动画运行路径</a><a href="#code-tour">逐行看代码</a><a href="#evidence">源码证据</a><a href="#architecture">架构定位</a><a href="#practice">练习与自测</a><a href="#takeaway">一句话带走</a></div>
            <div className="rail-note"><span>给第一次读源码的你</span><p>看不懂全部代码很正常。先认输入与输出，再找中间是谁接手，最后才看实现细节。</p></div>
          </>
        ) : (
          <>
            <div className="rail-progress"><span>路线进度</span><b>00 / {String(data.lessons.length).padStart(2, "0")}</b><i><em style={{ width: "4%", background: data.accent }} /></i></div>
            <div className="rail-toc"><span>总览目录</span><a href="#core-idea">核心理念</a><a href="#differences">五种架构区别</a><a href="#journey">完整请求旅程</a><a href="#course-map">八课路线图</a><a href="#curiosity">关键悬念</a><a href="#fit">适合与代价</a></div>
            <div className="rail-note"><span>总—分阅读法</span><p>先带着全局问题看八个局部，学完每一课后再回来检查：它究竟改变了整套系统的哪条边界？</p></div>
          </>
        )}
      </aside>
    </div>
  );
}

function CourseOverview({
  project,
  selectLesson,
}: {
  project: ProjectKey;
  selectLesson: (project: ProjectKey, id: string) => void;
}) {
  const data = projects[project];
  const overview = courseOverviews[project];

  return (
    <article className="course-overview">
      <header className="overview-hero">
        <div className="overview-eyebrow"><span style={{ background: data.accent }} />{overview.eyebrow}</div>
        <div className="overview-count">00 / {String(data.lessons.length).padStart(2, "0")}</div>
        <h1>{overview.headline}</h1>
        <p>{overview.thesis}</p>
        <div className="overview-actions">
          <button onClick={() => selectLesson(project, data.lessons[0].id)}>从 {data.lessons[0].id} 开始拆解 <span>→</span></button>
          <a href="#differences">先看它与另外两种架构的区别</a>
        </div>
        <div className="opening-prompt">
          <span>开场思考</span>
          <p>想象一次请求正在调用工具，用户突然补充新要求，同时系统还要保存历史并允许下次继续。<b>究竟由谁决定现在该继续、暂停、改写还是结束？</b></p>
        </div>
      </header>

      <section id="core-idea" className="overview-section">
        <div className="overview-section-head"><span>01</span><div><small>THE BIG IDEA</small><h2>先抓住一条核心设计理念</h2></div></div>
        <blockquote>{overview.tension}</blockquote>
        <div className="principle-grid">
          {overview.principles.map((principle, index) => (
            <div key={principle.title}><span>0{index + 1}</span><h3>{principle.title}</h3><p>{principle.detail}</p></div>
          ))}
        </div>
      </section>

      <section id="differences" className="overview-section">
        <div className="overview-section-head"><span>02</span><div><small>SAME PROBLEM, DIFFERENT BET</small><h2>它和另外两种架构，根本区别在哪里</h2></div></div>
        <p className="overview-lead">三者都能完成“模型调用工具”这件事。真正不同的是：当系统变复杂时，它们选择把复杂度放在哪里。</p>
        <div className="architecture-bets" role="table" aria-label="DSH、PI Agent 与 nanobot 核心架构区别">
          <div className="architecture-bet-head" role="row"><span>架构</span><span>它相信什么</span><span>最擅长什么</span><span>需要付出的代价</span></div>
          {architectureComparison.map((item) => (
            <div className={`architecture-bet-row ${item.key === project ? "current" : ""}`} role="row" key={item.key}>
              <strong>{item.name}{item.key === project && <small>当前路线</small>}</strong><p>{item.belief}</p><p>{item.strength}</p><p>{item.cost}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="journey" className="overview-section">
        <div className="overview-section-head"><span>03</span><div><small>ONE REQUEST JOURNEY</small><h2>先把一条完整请求跑通</h2></div></div>
        <p className="overview-lead">后面的八节课，会分别放大这条链路中的一个边界。先看全局动画，再进入局部，你就不会在文件和类型之间迷路。</p>
        <FlowDiagram steps={overview.journey} color={data.accent} />
      </section>

      <section id="course-map" className="overview-section">
        <div className="overview-section-head"><span>04</span><div><small>FROM WHOLE TO PARTS</small><h2>八节课怎样拼成一个完整答案</h2></div></div>
        <div className="overview-course-map">
          {data.lessons.map((lesson, index) => (
            <button key={lesson.id} onClick={() => selectLesson(project, lesson.id)}>
              <span style={{ color: lesson.groupColor }}>{lesson.id}</span>
              <small>{lesson.group}</small>
              <strong>{lesson.title}</strong>
              <p>{lesson.motto}</p>
              <i>{String(index + 1).padStart(2, "0")} / {String(data.lessons.length).padStart(2, "0")} →</i>
            </button>
          ))}
        </div>
      </section>

      <section id="curiosity" className="overview-section">
        <div className="overview-section-head"><span>05</span><div><small>QUESTIONS THAT PULL YOU FORWARD</small><h2>带着这三个悬念去读源码</h2></div></div>
        <div className="curiosity-list">
          {overview.questions.map((item, index) => (
            <details key={item.question}>
              <summary><span>0{index + 1}</span><strong>{item.question}</strong><i>展开线索 ＋</i></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="fit" className="overview-section">
        <div className="overview-section-head"><span>06</span><div><small>WHEN TO CHOOSE IT</small><h2>什么情况下值得学习这套设计</h2></div></div>
        <div className="fit-grid">
          <div><small>更适合</small><h3>当你需要这些能力</h3>{overview.bestFor.map((item) => <p key={item}><span>✓</span>{item}</p>)}</div>
          <div><small>先知道代价</small><h3>它不是免费的午餐</h3>{overview.tradeoffs.map((item) => <p key={item}><span>!</span>{item}</p>)}</div>
        </div>
      </section>

      <footer className="overview-finale">
        <small>READY TO UNPACK?</small>
        <h2>现在你已经看到森林，<br />下一步再去拆第一棵树。</h2>
        <button onClick={() => selectLesson(project, data.lessons[0].id)}>进入 {data.lessons[0].id} · {data.lessons[0].title} <span>→</span></button>
      </footer>
    </article>
  );
}

function repoSourceUrl(project: ProjectKey, file: string) {
  const data = projects[project];
  const targetType = /\/[^/]+\.[a-z0-9]+$/i.test(`/${file}`) ? "blob" : "tree";
  return `${data.repo}/${targetType}/${data.branch}/${file}`;
}

const glossaryRules: Array<{ match: RegExp; meaning: string }> = [
  { match: /session|history|jsonl|trajectory/i, meaning: "会话与历史记录：负责把已经发生的消息、工具结果和状态保存下来，方便恢复与回放。" },
  { match: /inbound|outbound|message|response/i, meaning: "系统里流动的一条标准消息。统一格式后，上下游就不必知道它最初来自哪个界面或模型。" },
  { match: /channel|websocket|delivery/i, meaning: "连接外部世界的入口或出口，负责收消息、做格式翻译，再把结果送回用户。" },
  { match: /bus|queue|inbox/i, meaning: "消息的中转站。生产者把任务放进去，消费者按顺序取走，从而避免模块直接绑死。" },
  { match: /memory|dream|soul|user/i, meaning: "比单轮对话更长期的信息，例如用户偏好、Agent 身份或从历史中提炼出的稳定事实。" },
  { match: /context|prompt|agents|skills/i, meaning: "模型在这一轮真正能看到的材料集合；它是按规则组装出来的视图，不等于全部存储内容。" },
  { match: /provider|model|llm|stream/i, meaning: "模型适配层与流式响应：把不同厂商的接口差异翻译成系统内部统一事件。" },
  { match: /tool|handler|schema|discovery/i, meaning: "Agent 可调用的外部能力。Schema 告诉模型怎么调用，Handler 负责真正执行。" },
  { match: /profile|bundle|patch|plugin|cordis|ctx/i, meaning: "可组合的功能模块或配置单元。系统通过安装、叠加和覆盖这些单元形成不同产品。" },
  { match: /turn|step|loop|runner|agent/i, meaning: "Agent 的执行边界：接收输入、请求模型、处理工具调用，并决定继续一轮还是结束。" },
  { match: /scope|seam|service/i, meaning: "能力的边界与作用范围，用来决定谁提供实现、谁能使用，以及什么时候回收。" },
  { match: /compact|summary|token|visibility/i, meaning: "上下文预算治理：决定保留什么、压缩什么，以及本轮哪些历史对模型可见。" },
  { match: /gateway|manager|cron|api|web/i, meaning: "产品外围的长期服务，负责启动、连接、定时任务和关闭，但不直接承担模型推理。" },
  { match: /final|result|future/i, meaning: "这条路径的输出。它可能直接展示给用户，也可能成为下一次循环的新输入。" },
];

function explainTerm(term: string) {
  return glossaryRules.find((rule) => rule.match.test(term))?.meaning
    ?? "流程中的一个职责节点。先观察它接收什么，再观察它把什么交给下一步，就能理解它的边界。";
}

function explainFlowStep(steps: string[], index: number) {
  const current = steps[index];
  const previous = steps[index - 1];
  const next = steps[index + 1];
  if (index === 0) return `请求从 ${current} 进入。这里先收集原始输入，并准备交给 ${next}。`;
  if (index === steps.length - 1) return `${current} 收拢前面各层的处理结果，形成用户或下一轮能够继续使用的输出。`;
  return `${current} 接过 ${previous} 的结果，只完成自己的职责，再把标准化后的结果交给 ${next}。`;
}

function Lecture({ lesson, project }: { lesson: Lesson; project: ProjectKey }) {
  const detail = lessonDetails[lesson.id];

  return (
    <article className="lecture">
      <section id="start">
        <div className="section-number">01</div>
        <div className="section-wide">
          <h2>小白导读：这节课到底讲什么</h2>
          <p className="section-lead">先别急着钻进源码。我们先用“问题—类比—目标”三步建立直觉，知道自己到底要找什么。</p>
          <div className="beginner-overview">
            <div><small>如果没有这一层</small><h3>系统会先乱在哪里？</h3><p>{lesson.why}</p></div>
            <div><small>生活中的类比</small><h3>把它想成什么？</h3><p>{lesson.model}</p></div>
            <div><small>学完本课</small><h3>你应该能说清</h3><p>{lesson.motto}</p></div>
          </div>
        </div>
      </section>
      <section id="terms">
        <div className="section-number">02</div>
        <div className="section-wide">
          <h2>先认几个术语，再看流程</h2>
          <p className="section-lead">不用背定义。只要能分清每个词“负责什么、不负责什么”，后面的代码就会容易很多。</p>
          <div className="glossary-grid">
            {lesson.flow.slice(0, 4).map((term, index) => (
              <div key={term}><span>{String(index + 1).padStart(2, "0")}</span><strong>{term}</strong><p>{explainTerm(term)}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section id="flow">
        <div className="section-number">03</div>
        <div className="section-wide">
          <h2>动画演示：一个请求怎样跑完整条链路</h2>
          <p className="section-lead">观察亮起的节点。每一步只接手上一层的结果，完成自己的职责，再把标准化结果交给下一层。</p>
          <FlowDiagram steps={lesson.flow} color={lesson.groupColor} />
        </div>
      </section>
      <section id="code-tour">
        <div className="section-number">04</div>
        <div className="section-wide">
          <h2>把流程翻译成代码</h2>
          <p className="section-lead">下面是为了教学简化过的控制流，不要求你先懂语法。按照右侧顺序找输入、处理、等待和输出即可。</p>
          <div className="beginner-code-tour">
            <div className="annotated-code" aria-label={`${lesson.id} 教学示意代码`}>
              <div><span>concept sketch</span><b>{lesson.id.toLowerCase()}_flow</b></div>
              <pre><code>{lesson.code.split("\n").map((line, index) => <span key={`${line}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i>{line || " "}</span>)}</code></pre>
            </div>
            <ol className="code-reading-guide">
              <li><span>1</span><p><b>先找输入</b>从 <code>{lesson.flow[0]}</code> 开始，不要一上来研究每个函数。</p></li>
              <li><span>2</span><p><b>再找接力</b>关注变量传给了谁，以及哪里出现 <code>await</code>、事件或回调。</p></li>
              <li><span>3</span><p><b>最后找出口</b>确认结果怎样抵达 <code>{lesson.flow.at(-1)}</code>，以及失败时会在哪里停住。</p></li>
            </ol>
          </div>
        </div>
      </section>
      <section id="evidence">
        <div className="section-number">05</div>
        <div className="section-wide">
          <h2>代码证据</h2>
          <p className="section-lead">不要只记结论。打开下面两个位置，沿着符号与调用方各追一层，就能在源码里验证这一课的边界。</p>
          <div className="evidence-grid">
            {detail.evidence.map((item, index) => (
              <a className="evidence-card" href={repoSourceUrl(project, item.file)} target="_blank" rel="noreferrer" key={`${item.file}-${item.symbol}`}>
                <span><small>EVIDENCE {String(index + 1).padStart(2, "0")}</small><b>↗</b></span>
                <code>{item.file}</code>
                <strong>{item.symbol}</strong>
                <p>{item.note}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section id="architecture">
        <div className="section-number">06</div>
        <div className="section-wide">
          <h2>放回整体架构</h2>
          <div className="architecture-card" style={{ borderColor: lesson.groupColor }}>
            <small>BOUNDARY / OWNERSHIP</small>
            <p>{detail.architecture}</p>
            <div className="architecture-axis">
              <code>{lesson.flow[0]}</code><i>→</i><strong>{lesson.title.split("：")[0]}</strong><i>→</i><code>{lesson.flow.at(-1)}</code>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="section-number">07</div>
        <div className="section-wide"><h2>这一层解决了什么</h2><div className="point-grid">{lesson.points.map((point, index) => <div key={point}><span>0{index + 1}</span><b>{point}</b></div>)}</div></div>
      </section>
      <section id="practice">
        <div className="section-number">08</div>
        <div className="section-wide">
          <h2>常见误区、动手练习与自测</h2>
          <div className="pitfall-list">
            <div><span>误区 01</span><p>把“{lesson.title.split("：")[0]}”理解成整个系统。它只是链路中的一个职责边界，前后仍然需要别的模块配合。</p></div>
            <div><span>误区 02</span><p>把流程图的箭头理解成函数一定直接互调。源码里也可能通过事件、队列、注册表或依赖注入完成接力。</p></div>
            <div><span>误区 03</span><p>试图第一次就读懂所有实现。小白更适合先追一条成功路径，再单独补错误、并发和生命周期分支。</p></div>
          </div>
          <div className="practice-lab">
            <div>
              <small>10 MINUTE LAB</small>
              <h3>跟着源码做一次“小侦探”</h3>
              <ol>
                <li>打开 <code>{detail.evidence[0].file}</code>，搜索 <code>{detail.evidence[0].symbol}</code>。</li>
                <li>找到它的输入来自哪里，并写下上游节点：<code>{lesson.flow[0]}</code>。</li>
                <li>找到结果交给谁，并写下最终出口：<code>{lesson.flow.at(-1)}</code>。</li>
                <li>用“谁拥有状态、谁只做转换”总结这层边界。</li>
              </ol>
            </div>
            <div className="self-check">
              <small>SELF CHECK</small>
              <h3>点开答案前，先用自己的话说</h3>
              <details><summary>Q1：这一层为什么存在？</summary><p>{lesson.why}</p></details>
              <details><summary>Q2：输入和输出分别是什么？</summary><p>输入从 <code>{lesson.flow[0]}</code> 进入，经过中间职责节点，最终抵达 <code>{lesson.flow.at(-1)}</code>。</p></details>
              <details><summary>Q3：整体架构里由谁拥有它？</summary><p>{detail.architecture}</p></details>
            </div>
          </div>
        </div>
      </section>
      <section id="takeaway">
        <div className="section-number">09</div>
        <div className="section-wide"><h2>一句话带走</h2><div className="takeaway">{lesson.takeaway}</div></div>
      </section>
    </article>
  );
}

function FlowDiagram({ steps, color }: { steps: string[]; color: string }) {
  const stepKey = steps.join("→");
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setActiveStep(0);
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [stepKey]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (activeStep >= steps.length - 1) setPlaying(false);
      else setActiveStep((current) => current + 1);
    }, 1350);
    return () => window.clearTimeout(timer);
  }, [activeStep, playing, steps.length]);

  const replay = () => {
    setActiveStep(0);
    setPlaying(true);
  };

  return (
    <div className="flow-player" style={{ "--flow-color": color } as CSSProperties}>
      <div className="flow-controls">
        <span>STEP {String(activeStep + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
        <div>
          <button type="button" onClick={() => setPlaying((current) => !current)}>{playing ? "暂停" : "继续"}</button>
          <button type="button" onClick={replay}>重播</button>
        </div>
      </div>
      <div className="flow-diagram" aria-label={`运行路径，当前步骤 ${activeStep + 1}：${steps[activeStep]}`}>
        {steps.map((step, index) => (
          <div className={`flow-fragment ${index < activeStep ? "done" : ""} ${index === activeStep ? "active" : ""}`} key={step}>
            <button type="button" className="flow-node" aria-current={index === activeStep ? "step" : undefined} onClick={() => { setActiveStep(index); setPlaying(false); }}>
              <small>{String(index + 1).padStart(2, "0")}</small><strong>{step}</strong><i />
            </button>
            {index < steps.length - 1 && <span className="flow-arrow">→</span>}
          </div>
        ))}
      </div>
      <div className="flow-caption" aria-live="polite"><span>当前发生</span><strong>{steps[activeStep]}</strong><p>{explainFlowStep(steps, activeStep)}</p></div>
    </div>
  );
}

function SourceMap({ lesson, project }: { lesson: Lesson; project: ProjectKey }) {
  return (
    <article className="source-map">
      <div className="source-intro"><span>SOURCE WALK</span><h2>从这 {lesson.files.length} 个位置开始追</h2><p>路径来自当前官方仓库的架构文档；示意代码用于突出控制流，不是逐字复制。</p></div>
      <div className="file-stack">
        {lesson.files.map((file, index) => (
          <a key={file} href={repoSourceUrl(project, file)} target="_blank" rel="noreferrer">
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
  const headers: Array<{ key: ProjectKey; name: string; subtitle: string }> = [
    { key: "dsh", name: "DSH", subtitle: "Composable Harness" },
    { key: "pi", name: "PI Agent", subtitle: "Minimal & Extensible" },
    { key: "nanobot", name: "nanobot", subtitle: "Readable Application" },
    { key: "claude", name: "Claude Code", subtitle: "Public SDK Boundary" },
    { key: "openclaw", name: "OpenClaw", subtitle: "Personal Agent OS" },
  ];
  const rows = [
    ["核心组织方式", "Cordis 插件树 + ctx", "四层包 + 极简核心", "分层 Python 模块 + 注册表", "官方 CLI + Python 控制 SDK", "Gateway + Harness + Runner + Core"],
    ["消息入口", "Agent inbox + typed events", "AgentSession + 双消息队列", "异步 MessageBus", "query() 或双向 ClaudeSDKClient", "Channel → Gateway → Routing"],
    ["Agent 执行", "agent-loop 插件 + turn/step", "Agent core + 事件流", "AgentLoop / AgentRunner 分工", "核心在官方 CLI；SDK 消费类型化事件", "Embedded Runner attempt loop"],
    ["状态真源", "append-only SessionEvent", "JSONL tree + active leaf", "Session 历史 + 长期 Memory", "session_id + transcript mirror", "Sessions 持久化 + session key"],
    ["扩展工具", "ctx.tools + waterfall 管线", "ExtensionAPI + tool hooks", "ToolRegistry / plugin entry points", "SDK MCP server + Hook / Permission", "agent-tools policy + plugin SDK"],
    ["模型替换", "ctx.llm seam provider", "pi-ai provider stream", "Provider 接口与 registry", "通过官方 CLI 选模型与配置", "Prepared model runtime generation"],
    ["产品组装", "Profile / Bundle / patch", "ResourceLoader + CLI / SDK / RPC", "Gateway 作为 composition root", "SDK options + plugins + agents", "Gateway 控制面 + Harness registry"],
    ["最强教学价值", "高度可组合、边界极致显式", "最小内核、工作流完全可塑", "清晰、直接、容易追调用链", "理解独立运行时的控制协议与安全边界", "理解生产级个人 Agent 的完整控制平面"],
  ];
  return (
    <main className="compare-page">
      <div className="compare-hero">
        <div className="eyebrow"><span /> SIDE BY SIDE · 横向对照</div>
        <h1>同一个 Agent 问题，<br /><em>五种系统答案。</em></h1>
        <p>从 DSH 的插件树、PI 的极简核心、nanobot 的清晰分层，到 Claude Code 的公开控制协议与 OpenClaw 的完整控制平面：它们不是强弱排序，而是五种复杂度预算。</p>
      </div>
      <div className="comparison-table">
        <div className="comparison-head">
          <span>架构问题</span>
          {headers.map((header) => <button key={header.key} onClick={() => navigate(header.key)}><b>{header.name}</b><small>{header.subtitle}</small></button>)}
        </div>
        {rows.map((row, index) => <div className="comparison-row" key={row[0]}><span><small>{String(index + 1).padStart(2, "0")}</small>{row[0]}</span>{row.slice(1).map((cell, cellIndex) => <p key={`${row[0]}-${headers[cellIndex].key}`}>{cell}</p>)}</div>)}
      </div>
      <section className="choice-section">
        <div><span>如果你更关心</span><h2>如何构建可换骨架的 Harness</h2><p>先读 DSH。它把插件生命周期、事件溯源、能力 seam 与产品组合都变成一等架构概念。</p><button onClick={() => navigate("dsh")}>进入 DSH 路线 →</button></div>
        <div><span>如果你更关心</span><h2>如何把工作流选择权交给用户</h2><p>先读 PI。它用极小 Agent core、会话树和统一扩展 API，展示“少内置、多可塑”的 Coding Harness。</p><button onClick={() => navigate("pi")}>进入 PI Agent 路线 →</button></div>
        <div><span>如果你更关心</span><h2>从一个能跑的个人 Agent 学起</h2><p>先读 nanobot。调用链短，Python 模块边界直接，消息、上下文、工具和记忆都能很快找到落点。</p><button onClick={() => navigate("nanobot")}>进入 nanobot 路线 →</button></div>
        <div><span>如果你更关心</span><h2>怎样安全控制一个独立 Agent 运行时</h2><p>读 Claude Code 公开部分。沿官方 SDK 看子进程协议、类型化事件、权限、Hook、MCP 工具与会话恢复。</p><button onClick={() => navigate("claude")}>进入 Claude Code 路线 →</button></div>
        <div><span>如果你更关心</span><h2>个人 Agent 如何长成生产级系统</h2><p>读 OpenClaw。Gateway、路由、Harness、Runner、prepared runtime 和插件契约会拼成一张完整系统地图。</p><button onClick={() => navigate("openclaw")}>进入 OpenClaw 路线 →</button></div>
      </section>
      <section className="final-thesis"><small>THE THESIS</small><blockquote>DSH 换骨架；PI 交工作流；nanobot 做分层；Claude Code 暴露<em>控制协议</em>；OpenClaw 搭起<em>控制平面</em>。</blockquote></section>
    </main>
  );
}
