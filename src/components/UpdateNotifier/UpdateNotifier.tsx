import { useCallback, useMemo } from 'react';
import { Alert, Button, Progress, Tooltip } from 'antd';
import type { UpdateStatusPayload } from '../../services/types';
import { useAutoUpdater } from '../../hooks/useAutoUpdater';
import './UpdateNotifier.css';

const formatBytes = (value?: number) => {
  if (!value || Number.isNaN(value)) return null;
  if (value < 1024) return `${value.toFixed(0)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const shouldShowBanner = (status?: UpdateStatusPayload | null) => {
  if (!status) return false;
  return status.state !== 'idle';
};

function UpdateNotifier() {
  const { status, checking, installing, supportsUpdater, checkForUpdates, installUpdate } =
    useAutoUpdater();

  const openReleasePage = useCallback(() => {
    window.open(
      status?.manualDownloadUrl ?? 'https://github.com/duobaobox/infinitynotex/releases',
      '_blank',
    );
  }, [status?.manualDownloadUrl]);

  const bannerContent = useMemo(() => {
    if (!status) return null;

    switch (status.state) {
      case 'checking':
        return <Alert type="info" showIcon title="正在检查更新..." />;
      case 'available':
        return (
          <Alert
            type="info"
            showIcon
            title={`发现新版本${status.version ? ` ${status.version}` : ''}`}
            description={
              status.canInstallAutomatically === false ? (
                <div className="update-notifier__actions">
                  <span>{status.message ?? '请前往发布页手动下载最新版。'}</span>
                  <Button size="small" type="primary" onClick={openReleasePage}>
                    手动下载
                  </Button>
                </div>
              ) : (
                '正在准备下载'
              )
            }
          />
        );
      case 'downloading':
        return (
          <Alert
            type="info"
            showIcon
            title={`正在下载更新${status.version ? ` ${status.version}` : ''}`}
            description={
              <div className="update-notifier__progress">
                <Progress
                  percent={status.percent ?? 0}
                  size="small"
                  showInfo={false}
                  status="active"
                />
                {(status.transferredBytes || status.totalBytes) && (
                  <span>
                    {formatBytes(status.transferredBytes)} / {formatBytes(status.totalBytes)}
                  </span>
                )}
              </div>
            }
          />
        );
      case 'downloaded':
        return (
          <Alert
            type="success"
            showIcon
            title={`更新包已就绪${status.version ? ` (${status.version})` : ''}`}
            description={
              <div className="update-notifier__actions">
                {status.releaseNotes && (
                  <Tooltip title={status.releaseNotes} placement="topRight">
                    <span className="update-notifier__notes">查看更新内容</span>
                  </Tooltip>
                )}
                <Button type="primary" size="small" loading={installing} onClick={installUpdate}>
                  立即重启更新
                </Button>
              </div>
            }
          />
        );
      case 'error':
        return (
          <Alert
            type="error"
            showIcon
            title="自动更新出现问题"
            description={status.errorMessage ?? '请稍后重试或检查网络连接'}
          />
        );
      case 'disabled':
        return <Alert type="warning" showIcon title="开发模式下自动更新已禁用" />;
      default:
        return null;
    }
  }, [status, installing, installUpdate, openReleasePage]);

  if (!supportsUpdater) {
    return null;
  }

  return (
    <div className="update-notifier__container" aria-live="polite">
      <div className="update-notifier__check">
        <Button size="small" onClick={checkForUpdates} loading={checking} disabled={checking}>
          检查更新
        </Button>
      </div>
      {shouldShowBanner(status) && bannerContent}
    </div>
  );
}

export default UpdateNotifier;
