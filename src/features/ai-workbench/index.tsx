// AI Workbench module - AI 工作台功能模块
import { RobotOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { ConversationListView } from './views/ConversationList/ConversationListView';
import { ChatEditor } from './views/ChatEditor';

// 注册 AI Chat Feature
registerFeature({
  id: 'ai-chat',
  workspaceView: 'tool',
  name: 'AI对话',
  icon: <RobotOutlined />,
  ListView: ConversationListView,
  EditorView: ChatEditor,
});

// 导出组件供外部使用
export { ConversationListView, ChatEditor };
