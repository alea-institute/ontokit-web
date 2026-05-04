import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import type { ReactNode, ReactElement } from "react";

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

export function renderWithQueryClient(ui: ReactElement, options?: RenderOptions) {
  const Wrapper = createQueryWrapper();
  return render(ui, { wrapper: Wrapper, ...options });
}

export function renderHookWithQueryClient<T>(hook: () => T) {
  return renderHook(hook, { wrapper: createQueryWrapper() });
}
