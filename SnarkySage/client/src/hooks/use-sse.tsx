
import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: () => void;
}

export function useSSE(url: string | null, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = (event) => {
      setIsConnected(true);
      options.onOpen?.(event);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage?.(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      options.onError?.(error);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
      options.onClose?.();
    };
  }, [url]);

  const close = () => {
    eventSourceRef.current?.close();
    setIsConnected(false);
  };

  return {
    isConnected,
    close
  };
}
