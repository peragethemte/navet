declare module '@docker/njs/entur-proxy.js' {
  const enturProxy: {
    handle(request: {
      uri: string;
      method?: string;
      args: { q?: string; limit?: string; bbox?: string };
      requestText?: string;
      headersOut: Record<string, string>;
      return(status: number, body: string): void;
    }): Promise<void>;
  };
  export default enturProxy;
}
