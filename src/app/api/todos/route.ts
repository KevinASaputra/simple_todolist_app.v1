import { connectToDatabase } from '@/lib/mongodb';
import { Todo, TodoType } from '@/models/Todo';
import { NextResponse } from 'next/server';

interface QueryParams {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
  sort?: string;
}

interface PaginatedResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: TodoType[];
}

export async function GET(request: Request) {
  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const params: QueryParams = Object.fromEntries(searchParams.entries());

  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(params.limit || '10', 10)), 100);
  const status = params.status;
  const search = params.search || '';
  const sortParam = params.sort || 'createdAt:desc';

  const [sortField, sortOrder] = sortParam.split(':');
  const sort: Record<string, 1 | -1> = {
    [sortField || 'createdAt']: sortOrder === 'asc' ? 1 : -1,
  };

  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const total: number = await Todo.countDocuments(filter);
  const items = await Todo.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();

  const totalPages = Math.ceil(total / limit) || 1;

  const response: PaginatedResponse = {
    page,
    limit,
    total,
    totalPages,
    items,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  await connectToDatabase();

  const body = (await request.json()) as Partial<TodoType>;

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ message: 'Title is required' }, { status: 400 });
  }

  const todo = await Todo.create({
    title: body.title,
    description: body.description || '',
    status: body.status || 'ongoing',
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
  });

  return NextResponse.json(todo, { status: 201 });
}
