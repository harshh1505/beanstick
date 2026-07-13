// protocol/mcp/client.ts
import { AXLBridge } from '../axl/bridge.js';
import { X402Client } from '../x402/client';

export class MCPAgentClient {
  private axl: AXLBridge;
  private x402?: X402Client;

  constructor(axlBridge: AXLBridge, x402Client?: X402Client) {
    this.axl = axlBridge;
    this.x402 = x402Client;
  }

  /**
   * Call a tool on a remote agent via AXL.
   * If the tool requires payment (402), automatically handles via x402.
   */
  async callTool(
    peerPublicKey: string,
    serviceName: string,
    toolName: string,
    params: object,
  ): Promise<any> {
    const response = await this.axl.mcpCall(
      peerPublicKey,
      serviceName,
      'tools/call',
      { name: toolName, arguments: params },
    );

    // Handle 402 Payment Required
    if (response.error?.code === 402 && this.x402) {
      console.log(`[MCP] Tool ${toolName} requires payment, using x402...`);
      const paymentInfo = response.error.data;
      const paidResponse = await this.callToolWithPayment(
        peerPublicKey, serviceName, toolName, params, paymentInfo
      );
      return paidResponse;
    }

    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }
    return JSON.parse(response.result.content[0].text);
  }

  /**
   * Call a tool with x402 payment attached.
   */
  private async callToolWithPayment(
    peerPublicKey: string,
    serviceName: string,
    toolName: string,
    params: object,
    paymentInfo: any,
  ): Promise<any> {
    if (!this.x402) throw new Error('x402 client not configured');

    // Use x402 fetch to handle payment challenge
    const paymentUrl = paymentInfo.paymentUrl || paymentInfo.facilitator;
    const res = await this.x402.fetch(paymentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: toolName,
        service: serviceName,
        peer: peerPublicKey,
        params,
      }),
    });

    if (!res.ok) {
      throw new Error(`x402 payment failed: ${res.status}`);
    }

    // Retry the MCP call with payment proof in params
    const settlement = this.x402.decodeSettlement(res) as any;
    const response = await this.axl.mcpCall(
      peerPublicKey,
      serviceName,
      'tools/call',
      {
        name: toolName,
        arguments: params,
        paymentProof: settlement?.transaction || settlement?.txHash || '',
      }
    );

    if (response.error) {
      throw new Error(`MCP error after payment: ${response.error.message}`);
    }
    return JSON.parse(response.result.content[0].text);
  }

  /**
   * List tools available on a remote agent.
   */
  async listTools(peerPublicKey: string, serviceName: string): Promise<any[]> {
    const response = await this.axl.mcpCall(
      peerPublicKey,
      serviceName,
      'tools/list',
      {},
    );
    return response.result.tools;
  }
}
