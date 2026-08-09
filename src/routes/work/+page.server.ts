import { loadCollection } from '$lib/server/markdown';
import { orderWork } from '$lib/work/order.js';
import workOrder from '$content/meta/work-order.json';

const orderSlugs = workOrder.order.map((e) => e.project);

export async function load() {
	const work = orderWork(loadCollection('src/content/work'), orderSlugs);
	return { work };
}
