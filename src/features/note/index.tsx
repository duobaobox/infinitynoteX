// Note module - 便签功能模块
import { AppstoreOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { NoteListView } from './views/NoteList/NoteListView';
import { NoteEditor } from './views/NoteEditor';

// 注册 Note Feature
registerFeature({
  id: 'note',
  workspaceView: 'note',
  name: '便签',
  icon: <AppstoreOutlined />,
  ListView: NoteListView,
  EditorView: NoteEditor,
});

// 导出组件供外部使用
export { NoteListView, NoteEditor };
