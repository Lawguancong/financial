import React, { useState, useMemo } from 'react';
import { Button, Drawer, Input, Collapse, Tag, Empty } from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type { CollapseProps } from 'antd';
import { menuConfigs, menuPathMap } from '@/config/menuConfig';
import type { MenuItemConfig } from '@/config/menuConfig';
import { userManualItems } from '@/config/userManualConfig';

const { Search } = Input;

interface ManualTreeItem {
  menuKey: string;
  pathLabel: string; // 形如 "股票 > A股 > 指数"
  features: string[];
}

/** 把扁平的手册条目按菜单层级展开，并获取完整路径名称 */
const buildManualTree = (): ManualTreeItem[] => {
  const keyPathMap: Record<string, string> = {};

  const walk = (items: MenuItemConfig[], parentPath: string[]) => {
    items.forEach(item => {
      const curPath = [...parentPath, item.label];
      keyPathMap[item.key] = curPath.join(' > ');
      if (item.children) {
        walk(item.children, curPath);
      }
    });
  };
  walk(menuConfigs, []);

  return userManualItems.map(item => ({
    menuKey: item.menuKey,
    pathLabel: keyPathMap[item.menuKey] || item.menuKey,
    features: item.features,
  }));
};

const manualTree = buildManualTree();

/** 按一级菜单分组 */
const groupedByTopLevel = () => {
  const topLevelMap: Record<string, { label: string; icon: React.ReactNode; items: ManualTreeItem[] }> = {};

  const iconMap: Record<string, React.ReactNode> = {};
  menuConfigs.forEach(item => {
    iconMap[item.key] = item.icon || null;
    topLevelMap[item.key] = {
      label: item.label,
      icon: item.icon || null,
      items: [],
    };
  });

  manualTree.forEach(item => {
    const topKey = item.menuKey.split('/')[0];
    if (topLevelMap[topKey]) {
      topLevelMap[topKey].items.push(item);
    }
  });

  // 按菜单配置顺序返回
  return menuConfigs
    .map(cfg => topLevelMap[cfg.key])
    .filter(group => group && group.items.length > 0);
};

interface UserManualProps {
  /** 自定义触发按钮（可选），不传则使用默认高亮按钮 */
  trigger?: React.ReactNode;
}

const UserManual: React.FC<UserManualProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const groups = useMemo(() => groupedByTopLevel(), []);

  // 搜索过滤
  const filteredGroups = useMemo(() => {
    if (!searchText.trim()) return groups;
    const keyword = searchText.trim().toLowerCase();
    return groups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.pathLabel.toLowerCase().includes(keyword) ||
          item.features.some(f => f.toLowerCase().includes(keyword)),
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [groups, searchText]);

  const handleJumpToPage = (menuKey: string) => {
    const path = menuPathMap[menuKey];
    if (path) {
      window.open(path, '_blank');
    }
  };

  const collapseItems: CollapseProps['items'] = filteredGroups.map(group => ({
    key: group.label,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ color: '#1677ff' }}>{group.icon}</span>
        <span>{group.label}</span>
        <Tag color="blue" style={{ marginLeft: 8 }}>
          {group.items.length} 个页面
        </Tag>
      </span>
    ),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {group.items.map(item => (
          <div
            key={item.menuKey}
            style={{
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: 8,
              border: '1px solid #f0f0f0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: '#1677ff',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                onClick={() => handleJumpToPage(item.menuKey)}
              >
                <ArrowRightOutlined style={{ fontSize: 12, marginRight: 4 }} />
                {item.pathLabel}
              </span>
              <Button
                type="link"
                size="small"
                onClick={() => handleJumpToPage(item.menuKey)}
              >
                前往页面
              </Button>
            </div>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#555', lineHeight: 1.9 }}>
              {item.features.map((feat, i) => (
                <li key={i}>{feat}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  }));

  const defaultTrigger = (
    <Button
      type="primary"
      icon={<BookOutlined />}
      onClick={() => setOpen(true)}
      style={{
        background: 'linear-gradient(135deg, #fa8c16 0%, #faad14 100%)',
        border: 'none',
        boxShadow: '0 2px 10px rgba(250, 140, 22, 0.4)',
        fontWeight: 600,
        animation: 'userManualPulse 2s ease-in-out infinite',
      }}
    >
      使用手册
      <style>{`
        @keyframes userManualPulse {
          0%, 100% { box-shadow: 0 2px 10px rgba(250, 140, 22, 0.4); }
          50% { box-shadow: 0 4px 20px rgba(250, 140, 22, 0.7); }
        }
      `}</style>
    </Button>
  );

  return (
    <>
      {trigger || defaultTrigger}
      <Drawer
        title={
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            <BookOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
            使用手册
          </span>
        }
        placement="right"
        width={640}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Tag color="orange" style={{ fontSize: 13 }}>
            共 {manualTree.length} 个功能页
          </Tag>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索功能、页面名称..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={value => setSearchText(value)}
          />
        </div>

        {filteredGroups.length === 0 ? (
          <Empty description="未找到相关功能说明" style={{ marginTop: 60 }} />
        ) : (
          <Collapse
            defaultActiveKey={filteredGroups.map(g => g.label)}
            activeKey={activeKeys.length > 0 ? activeKeys : undefined}
            onChange={keys => setActiveKeys(keys as string[])}
            items={collapseItems}
            style={{ background: 'transparent' }}
          />
        )}

        <div
          style={{
            marginTop: 24,
            padding: '12px 16px',
            background: '#fff7e6',
            borderRadius: 8,
            fontSize: 13,
            color: '#d46b08',
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 使用提示</div>
          <div>点击页面名称或「前往页面」可在新标签页打开对应功能。</div>
          <div>手册按左侧菜单顺序编排，可使用顶部搜索框快速定位。</div>
        </div>
      </Drawer>
    </>
  );
};

export default UserManual;
