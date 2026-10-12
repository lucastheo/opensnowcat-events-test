import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('main.tsx entrypoint', () => {
  let rootDiv: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    rootDiv = document.createElement('div');
    rootDiv.id = 'root';
    document.body.appendChild(rootDiv);
  });

  afterEach(() => {
    if (rootDiv && rootDiv.parentNode) {
      rootDiv.parentNode.removeChild(rootDiv);
    }
  });

  it('initializes OpenSnowcat tracker and mounts application into #root', async () => {
    const renderMock = vi.fn();
    const createRootMock = vi.fn().mockReturnValue({ render: renderMock });
    const initSnowcatTrackerMock = vi.fn();

    vi.doMock('react-dom/client', () => ({
      default: {
        createRoot: createRootMock
      },
      createRoot: createRootMock
    }));

    vi.doMock('@/tracker/snowcat', () => ({
      initSnowcatTracker: initSnowcatTrackerMock
    }));

    await import('@/main');

    expect(initSnowcatTrackerMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(rootDiv);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
