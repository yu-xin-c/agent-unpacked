# Agent Unpacked source baseline

教程中的源码结论必须绑定下列固定提交。页面链接不得指向会继续移动的 `main` / `master`，也不得用目录名代替具体证据。

| 课程 | 上游仓库 | 审计提交 | 本地审计副本 |
| --- | --- | --- | --- |
| DSH | `deepseek-ai/deepseek-harness` | `47f943859bef60e4160492346772ded9b24f765a` | `source-audit/dsh` |
| PI Agent | `badlogic/pi-mono` | `d3ab2af969d64997338253c9151190aa1bc33580` | `source-audit/pi-mono` |
| nanobot | `HKUDS/nanobot` | `c27b1f14c3695da233a7733a478d66ef6d6943d4` | `source-audit/nanobot` |
| Claude Code 复原版 | `claude-code-best/claude-code` | `3bb6b5746238c418138eb96d57765d79012edd96` | `source-audit/claude-code` |
| OpenClaw | `openclaw/openclaw` | `0a6a1d94192b5ffe3532df0195ac383f53b4b772` | `source-audit/openclaw-local` |

## 证据标准

1. **代码事实**：由固定提交中的实现直接支持，链接到文件与行号。
2. **测试证据**：由测试、fixture 或断言支持，只证明测试覆盖的行为。
3. **架构推断**：由多个代码事实共同推出，必须明确标注为解释，不冒充作者原话。
4. 教学伪代码必须标注为 `concept sketch`，不能伪装成仓库原文。
5. 每课至少同时覆盖定义/状态与组装/消费两侧，不能只凭一个类名下结论。

## 阅读进度

- DSH：已完成仓库级索引，以及 Cordis、boot/profile、session、agent-loop、tools、scope、compaction、web/headless 八条关键执行路径的实现审计；课程证据已改为固定提交与行号。
- PI Agent：已完成包级索引，以及 pi-ai Provider/Models、经典 Agent 两层循环、消息双投影、工具批次、AgentSession 提交屏障、JSONL tree、ResourceLoader/Extension 信任重载路径的实现审计。另核对了公开 `AgentHarness`：持久层与 reducer 已有实现，但 `prompt` / `steer` / `resume` / `watch` 等主路径仍显式 `HarnessNotImplemented`，页面已把它标成 vNext 施工路径而非当前产品运行时。
- nanobot：已完成包级索引，以及 Inbound/Outbound 信封、per-session dispatch 与 mid-turn injection、七阶段 Turn、Runner checkpoint、三重上下文投影、ProviderSnapshot admission、工具发现/校验/并发分批、原子 JSONL、Consolidator/AutoCompact、Dream 受限文件事务与 Gateway 资源所有权路径的实现审计；课程证据已改为固定提交与行号。
- Claude Code 复原版：已完成全仓索引，以及 CLI import/fast-path 拓扑、REPL 与 QueryEngine 两种产品外壳、queryLoop model-view projection 与具名恢复迁移、provider stream、Tool 能力契约、并发结果流与确定性 context commit、schema/Hook/permission 决策格、system/user/memory 三类上下文优先级、auto-compact、preserved-segment relink、并行 tool-result DAG 恢复、MCP Tool 适配与 plugin source policy 的实现审计；课程证据已改为固定提交与行号。该仓库始终标为第三方逆向复原，不表述为 Anthropic 官方源码。
- OpenClaw：已完成全仓与 scoped `AGENTS.md` 约束阅读，以及 Channel Turn admission/record/delivery settlement、binding tier 与 session-key identity、Harness 选择、embedded runner 的 session/global lane 与 bounded retry、`@openclaw/agent-core` 双层循环和工具批次、prepared model runtime replacement gate/owner batch/lease、tool surface policy 与 `before_tool_call` 最终参数闸门、manifest-first 插件激活与 Harness registry/Plugin SDK 边界的实现审计；课程证据已改为固定提交与精确行号。

这里的“完成审计”指：仓库文件与包边界已全量索引，课程涉及的定义、调用方、消费方、失败路径及相关测试已逐段核对。未完成的系统不会在页面或发布说明中声称已经完整阅读。
