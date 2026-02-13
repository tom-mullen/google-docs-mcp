import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';
import { DocumentIdParameter } from '../../types.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'addDocumentTab',
    description:
      'Creates a new tab in a Google Document. Returns the new tab ID, title, and index.',
    parameters: DocumentIdParameter.extend({
      title: z.string().describe('The title for the new tab.'),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('The zero-based position to insert the tab. If omitted, the tab is appended at the end.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Adding tab "${args.title}" to document: ${args.documentId}`);

      try {
        const tabProperties: Record<string, any> = { title: args.title };
        if (args.index !== undefined) {
          tabProperties.index = args.index;
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                addDocumentTab: {
                  tabProperties,
                },
              },
            ],
          },
        });

        const reply = res.data.replies?.[0] as any;
        const newTabProps = reply?.addDocumentTab?.tabProperties;

        if (!newTabProps) {
          throw new UserError('Tab was created but no tab properties were returned.');
        }

        return JSON.stringify(
          {
            tabId: newTabProps.tabId,
            title: newTabProps.title,
            index: newTabProps.index,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error adding tab to doc ${args.documentId}: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(`Document not found (ID: ${args.documentId}).`);
        if (error.code === 403)
          throw new UserError(`Permission denied for document (ID: ${args.documentId}).`);
        throw new UserError(`Failed to add tab: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
