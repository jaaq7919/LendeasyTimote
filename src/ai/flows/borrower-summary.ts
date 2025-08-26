'use server';

/**
 * @fileOverview AI-powered tool to summarize loan details, payment history, and risk factors for each borrower.
 *
 * - generateBorrowerSummary - A function that generates a summary of a borrower's loan details, payment history, and risk factors.
 * - GenerateBorrowerSummaryInput - The input type for the generateBorrowerSummary function.
 * - GenerateBorrowerSummaryOutput - The return type for the generateBorrowerSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBorrowerSummaryInputSchema = z.object({
  borrowerDetails: z.string().describe('Details of the borrower, including personal information and contact details.'),
  loanDetails: z.string().describe('Details of the loan, including loan amount, interest rate, payment schedule, and due dates.'),
  paymentHistory: z.string().describe('A record of the borrower’s payment history, including dates and amounts paid.'),
});
export type GenerateBorrowerSummaryInput = z.infer<typeof GenerateBorrowerSummaryInputSchema>;

const GenerateBorrowerSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the borrower’s loan details, payment history, and risk factors.'),
});
export type GenerateBorrowerSummaryOutput = z.infer<typeof GenerateBorrowerSummaryOutputSchema>;

export async function generateBorrowerSummary(input: GenerateBorrowerSummaryInput): Promise<GenerateBorrowerSummaryOutput> {
  return generateBorrowerSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBorrowerSummaryPrompt',
  input: {schema: GenerateBorrowerSummaryInputSchema},
  output: {schema: GenerateBorrowerSummaryOutputSchema},
  prompt: `You are an AI assistant that summarizes borrower information for lenders.

  Given the following information about a borrower, create a concise summary of their loan details, payment history, and risk factors. The summary should be no more than 200 words.

  Borrower Details: {{{borrowerDetails}}}
  Loan Details: {{{loanDetails}}}
  Payment History: {{{paymentHistory}}}

  Summary: `,
});

const generateBorrowerSummaryFlow = ai.defineFlow(
  {
    name: 'generateBorrowerSummaryFlow',
    inputSchema: GenerateBorrowerSummaryInputSchema,
    outputSchema: GenerateBorrowerSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
