"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export type State = {
	errors?: {
		customerId?: string[];
		amount?: string[];
		status?: string[];
	};
	message?: string | null;
};

const FormSchema = z.object({
	id: z.string(),
	customerId: z.string({
		invalid_type_error: "Please select a customer.",
	}),
	amount: z.coerce
		.number()
		.gt(0, { message: "Please enter a number greater than $0." }),
	status: z.enum(["pending", "paid"], {
		invalid_type_error: "Please select an invoice status.",
	}),
	date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
	const validatedFields = CreateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validatedFields.success) {
		return {
			errors: validatedFields.error.flatten().fieldErrors,
			message: "Missing Fields. Failed to Create Invoice.",
		};
	}

	// Prepare data for insertion into the database
	const { customerId, amount, status } = validatedFields.data;
	const amountInCents = amount * 100;
	const date = new Date().toISOString().split("T")[0];

	// Insert data into the database
	try {
		await sql`
          INSERT INTO invoices (customer_id, amount, status, date)
          VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
	} catch (error) {
		// log the error to the console
		console.error(error);
		return {
			message: "Database Error: Failed to Create Invoice.",
		};
	}

	// revalidate the data in the route cache
	revalidatePath("/dashboard/invoices");

	// redirect the user to the invoices page
	redirect("/dashboard/invoices");
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
	id: string,
	prevState: State,
	formData: FormData,
) {
	const validatedFields = UpdateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validatedFields.success) {
		return {
			errors: validatedFields.error.flatten().fieldErrors,
			message: "Missing Fields. Failed to Update Invoice.",
		};
	}

	// Prepare data for updating the database
	const { customerId, amount, status } = validatedFields.data;
	const amountInCents = amount * 100;

	// Update the database
	try {
		await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
	} catch (error) {
		console.log(error);

		return {
			message: "Database Error: Failed to Update Invoice.",
		};
	}

	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
	try {
		await sql`DELETE FROM invoices WHERE id = ${id}`;
		revalidatePath("/dashboard/invoices");
	} catch (error) {
		console.log(error);

		return {
			message: "Database Error: Failed to Delete Invoice.",
		};
	}
}
