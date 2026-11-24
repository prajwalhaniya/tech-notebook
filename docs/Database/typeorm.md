---
sidebar_position: 2
---

# TypeORM

TypeORM is a TypeScript/JavaScript ORM (Object-Relational Mapping tool — it maps database tables to classes, so you work with objects instead of hand-written SQL) that runs in Node.js, the browser, Cordova, Ionic, React Native, and Electron. It supports PostgreSQL, MySQL, MariaDB, SQLite, MS SQL Server, Oracle, and more, and lets you switch between them by changing connection options rather than rewriting your queries.

* * *

## Installation & Setup

### Install TypeORM

TypeORM reads your TypeScript decorators (`@Entity`, `@Column`) at runtime to build its schema, which requires the `reflect-metadata` polyfill alongside the ORM itself. You also need a driver package for whichever database you're connecting to — `pg` for PostgreSQL, `mysql2` for MySQL.

```bash
# With PostgreSQL driver
npm install typeorm pg reflect-metadata

# With MySQL driver
npm install typeorm mysql2 reflect-metadata

# TypeScript support
npm install -D @types/node typescript ts-node
```

### Configure tsconfig.json

Decorators didn't become a finished JavaScript standard until 2022, so using them in a TypeORM project before that needs two compiler flags: `experimentalDecorators` turns on the decorator syntax itself, and `emitDecoratorMetadata` makes TypeScript emit the type information that `reflect-metadata` reads at runtime — it's how TypeORM infers that a `string` property should become a `varchar` column without you stating the SQL type explicitly.

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "lib": ["ES2021"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Data Source Setup

A `DataSource` is TypeORM's connection object — it holds the database credentials, the list of entities it manages, and the connection pool. You create one instance per application and call `.initialize()` once at startup, before running any queries.

Two options are worth flagging. `synchronize: true` makes TypeORM auto-generate and alter tables to match your entities, which is convenient in development but risky in production — it can drop a column, or the data in it, the moment an entity definition changes in a way TypeORM reconciles differently than you expected. `logging: true` prints every generated SQL statement to the console, which is the fastest way to see why a query isn't returning what you expect.

```typescript
// src/data-source.ts
import { DataSource } from "typeorm";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "password",
  database: "mydb",
  synchronize: true,  // Auto-create tables (dev only!)
  logging: true,       // Log SQL queries
  entities: [User],
  migrations: ["src/migrations/**/*.ts"],
  subscribers: [],
});

// Initialize connection
AppDataSource.initialize()
  .then(() => {
    console.log("Data Source initialized");
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
  });
```

### Environment Variables

Hardcoding credentials, as the example above does, means a developer's local password ends up committed to source control. A real setup reads configuration from environment variables instead, and disables `synchronize` once `NODE_ENV` is `production`, so a deployment can't reshape the schema outside of a reviewed migration.

```typescript
// src/data-source.ts with dotenv
import "dotenv/config";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
  entities: ["src/entities/**/*.ts"],
  migrations: ["src/migrations/**/*.ts"],
});
```

* * *

## Entities

An entity is a class decorated with `@Entity()` that maps to a database table — one instance of the class corresponds to one row. TypeORM infers the table name from the class name unless you pass one explicitly, the way `@Entity("users")` below maps the `User` class to a table literally named `users`.

### Basic Entity

`@PrimaryGeneratedColumn()` creates an auto-incrementing integer primary key. `@Column()` marks a property as a mapped column, with options like `type`, `length`, and `unique` controlling the generated DDL (Data Definition Language — the SQL that creates or alters the table). `@CreateDateColumn()` and `@UpdateDateColumn()` are managed automatically: TypeORM sets `createdAt` once on insert and bumps `updatedAt` on every save, so you never set either one yourself.

```typescript
// src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")  // Table name
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "text" })
  passwordHash: string;

  @Column({ type: "int", default: 0 })
  age: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Column Types

TypeORM maps each `@Column()` to a database-specific SQL type, and some of these exist only on certain drivers — `jsonb` and native array columns (`@Column("text", { array: true })`) are PostgreSQL-only, and would need a workaround like a stringified JSON column on MySQL. The enum column below generates a check constraint, or a native SQL `ENUM` on databases that support one, restricting `status` to the four listed values.

```typescript
@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // String types
  @Column("varchar", { length: 100 })
  name: string;

  @Column("text")
  description: string;

  // Number types
  @Column("int")
  stock: number;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column("float")
  rating: number;

  // Boolean
  @Column("boolean", { default: true })
  available: boolean;

  // Date/Time
  @Column("date")
  releaseDate: Date;

  @Column("timestamp")
  lastModified: Date;

  @Column("timestamptz")  // With timezone (PostgreSQL)
  publishedAt: Date;

  // JSON (PostgreSQL)
  @Column("jsonb")
  metadata: object;

  // Array (PostgreSQL)
  @Column("text", { array: true })
  tags: string[];

  @Column("int", { array: true })
  relatedIds: number[];

  // Enum
  @Column({
    type: "enum",
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending"
  })
  status: string;

  // UUID
  @Column("uuid")
  externalId: string;
}
```

### Column Options

`nullable: false` and `unique: true` become real SQL constraints (`NOT NULL`, `UNIQUE`), not just TypeScript-level hints — inserting a duplicate `name` throws a database error, not a silent no-op. `select: false` is for sensitive columns like `secretKey`: TypeORM leaves them out of `find()` results by default, so a careless `JSON.stringify(user)` doesn't leak them, and you only get the value back by explicitly asking with `.addSelect()`. `update: false` protects fields like `createdBy` that should be set once on insert and never change afterward.

```typescript
@Entity()
export class Example {
  @Column({
    type: "varchar",
    length: 100,
    nullable: false,      // NOT NULL
    unique: true,         // UNIQUE constraint
    default: "default",   // Default value
    comment: "User's display name"
  })
  name: string;

  @Column({ select: false })  // Exclude from SELECT by default
  secretKey: string;

  @Column({ update: false })  // Cannot be updated after insert
  createdBy: string;
}
```

### Primary Keys

Most tables use a single auto-incrementing integer (`@PrimaryGeneratedColumn()`), but TypeORM also supports UUID primary keys for cases where you need an identifier that stays unique across separate databases or services (`@PrimaryGeneratedColumn("uuid")`). A composite primary key, shown in `OrderItem` below, is for join or junction tables where no single column uniquely identifies a row — combining `orderId` and `productId` does.

```typescript
// Auto-increment
@PrimaryGeneratedColumn()
id: number;

// UUID
@PrimaryGeneratedColumn("uuid")
id: string;

// Custom primary key
@PrimaryColumn()
customId: string;

// Composite primary key
@Entity()
export class OrderItem {
  @PrimaryColumn()
  orderId: number;

  @PrimaryColumn()
  productId: number;

  @Column()
  quantity: number;
}
```

* * *

## Relationships

TypeORM represents foreign-key relationships as decorated class properties, and it keeps standard relational-database terminology — `@OneToMany`, `@ManyToOne`, `@ManyToMany` — rather than inventing its own vocabulary.

### One-to-Many / Many-to-One

A one-to-many and a many-to-one relationship are two sides of the same foreign key — one `User` has many `Post` rows, and each `Post` belongs to exactly one `User`. `@ManyToOne` goes on the side that owns the foreign-key column (`userId` on `Post`), and `@JoinColumn` tells TypeORM which column holds it. `onDelete: "CASCADE"` pushes the deletion rule into the database itself: deleting a user deletes their posts in the same operation, instead of leaving orphaned rows behind.

```typescript
// User has many Posts
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];
}

// Post belongs to User
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: "CASCADE"  // Delete posts when user is deleted
  })
  @JoinColumn({ name: "userId" })
  user: User;
}
```

### Many-to-Many

A many-to-many relationship, like users and roles, needs a junction table to store the pairings, since neither table can hold a single foreign key for an association where one row on each side can match many rows on the other. `@JoinTable()` on the owning side (`User` here) tells TypeORM to create and manage that junction table — named `user_roles` below — automatically; the inverse side (`Role`) only needs a plain `@ManyToMany` pointing back.

```typescript
// User has many Roles, Role has many Users
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: "user_roles",  // Junction table name
    joinColumn: { name: "user_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "role_id", referencedColumnName: "id" }
  })
  roles: Role[];
}

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}
```

### One-to-One

A one-to-one relationship splits a table's data into two tables, usually because the second half is optional or read far less often — a `User` and its `Profile` (bio, avatar) here. `cascade: true` on the owning side means saving a `User` with a new `profile` attached also inserts the `Profile` row in the same call, instead of requiring a separate `profileRepository.save()`.

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true  // Save profile when saving user
  })
  profile: Profile;
}

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bio: string;

  @Column()
  userId: number;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: "userId" })
  user: User;
}
```

### Cascade Options

`cascade` controls which operations ripple from the parent entity to the related one at the TypeORM level — `cascade: ["insert"]` only propagates new related records, while `cascade: true` propagates every operation. `onDelete` and `onUpdate` are different: they're database-level foreign-key rules, enforced by the DBMS even if a query bypasses TypeORM entirely. Use both together — `cascade` for ORM convenience, `onDelete: "CASCADE"` as the safety net underneath it.

```typescript
@ManyToOne(() => User, (user) => user.posts, {
  cascade: true,        // All operations
  cascade: ["insert"],  // Only on insert
  cascade: ["update"],  // Only on update
  cascade: ["remove"],  // Only on delete
  onDelete: "CASCADE",  // Database-level cascade
  onUpdate: "CASCADE"
})
user: User;
```

### Eager vs Lazy Loading

Eager loading fetches the related entity automatically on every query against the owning entity — convenient, but it adds a join to every query regardless of whether that query needs the relation, so it's worth reserving for relations you touch almost always. Lazy loading defers the query until you access the property, at the cost of returning a `Promise` instead of the entity itself, and every access fires its own round trip to the database. Neither extreme is usually right for a hot path — see Explicit Loading under Performance Optimization below for the common middle ground.

```typescript
// Eager loading - automatically load relations
@ManyToOne(() => User, (user) => user.posts, { eager: true })
user: User;

// Lazy loading - load when accessed (returns Promise)
@ManyToOne(() => User, (user) => user.posts)
user: Promise<User>;

// Usage with lazy loading
const post = await postRepository.findOne({ where: { id: 1 } });
const user = await post.user;  // Separate query
```

* * *

## Repository Pattern

A repository is TypeORM's main interface for querying and persisting an entity. `AppDataSource.getRepository(User)` returns an object with `find`, `save`, `delete`, and similar methods, all scoped to the `User` table.

### Basic CRUD Operations

`create()` builds a plain entity instance in memory without touching the database; `save()` is what actually runs the `INSERT` or `UPDATE`. Calling `save()` directly on a plain object, as the `newUser` example does, performs both steps in one call. `findOneOrFail` behaves like `findOne` but throws instead of returning `null` — useful when a missing record signals a bug rather than an expected outcome. Soft delete, covered under Advanced Features below, replaces a hard `DELETE` with a timestamp column, so the row — and the option to restore it — survives.

```typescript
import { AppDataSource } from "./data-source";
import { User } from "./entities/User";

const userRepository = AppDataSource.getRepository(User);

// CREATE
const user = userRepository.create({
  username: "john_doe",
  email: "john@example.com",
  passwordHash: "hashed_password"
});
await userRepository.save(user);

// Alternative
const newUser = await userRepository.save({
  username: "jane_doe",
  email: "jane@example.com",
  passwordHash: "hashed_password"
});

// INSERT multiple
await userRepository.insert([
  { username: "user1", email: "user1@example.com", passwordHash: "hash1" },
  { username: "user2", email: "user2@example.com", passwordHash: "hash2" }
]);

// READ
const allUsers = await userRepository.find();
const activeUsers = await userRepository.find({ where: { isActive: true } });
const oneUser = await userRepository.findOne({ where: { id: 1 } });
const userByEmail = await userRepository.findOneBy({ email: "john@example.com" });

// findOneOrFail - throws error if not found
const user = await userRepository.findOneOrFail({ where: { id: 1 } });

// UPDATE
await userRepository.update({ id: 1 }, { username: "new_username" });

// Alternative - load, modify, save
const user = await userRepository.findOneBy({ id: 1 });
user.username = "updated_name";
await userRepository.save(user);

// DELETE
await userRepository.delete({ id: 1 });
await userRepository.delete({ isActive: false });

// Alternative - load and remove
const user = await userRepository.findOneBy({ id: 1 });
await userRepository.remove(user);

// Soft delete (requires @DeleteDateColumn)
await userRepository.softDelete({ id: 1 });
await userRepository.restore({ id: 1 });  // Restore soft-deleted
```

### Find Options

The `where` object accepts a plain value for equality, an array for OR conditions (the `username`-or-`email` example below), and TypeORM's operator functions — `In`, `Not`, `MoreThan`, `Like` — for anything else. `relations` triggers a SQL join to pull in related entities within the same query; nesting it, as `relations: { posts: { comments: true } }` does, joins two levels deep in one round trip instead of three separate queries.

```typescript
// Where conditions
await userRepository.find({
  where: { isActive: true }
});

// Multiple conditions (AND)
await userRepository.find({
  where: { isActive: true, age: 25 }
});

// OR conditions
import { In, Not, LessThan, MoreThan, Like } from "typeorm";

await userRepository.find({
  where: [
    { username: "john" },
    { email: "john@example.com" }
  ]
});

// Operators
await userRepository.find({
  where: {
    id: In([1, 2, 3, 4]),
    age: MoreThan(18),
    username: Not("admin"),
    email: Like("%@gmail.com")
  }
});

// Select specific columns
await userRepository.find({
  select: ["id", "username", "email"]
});

// Relations
await userRepository.find({
  relations: ["posts", "profile"]
});

// Nested relations
await userRepository.find({
  relations: {
    posts: {
      comments: true
    }
  }
});

// Order
await userRepository.find({
  order: { createdAt: "DESC", username: "ASC" }
});

// Pagination
await userRepository.find({
  skip: 20,   // OFFSET
  take: 10    // LIMIT
});

// Combined
await userRepository.find({
  where: { isActive: true },
  relations: ["posts"],
  select: ["id", "username"],
  order: { createdAt: "DESC" },
  take: 10
});
```

### Advanced Operators

Operators like `Between`, `IsNull`, and `ILike` (PostgreSQL's case-insensitive `LIKE`) build the SQL condition for you while still parameterizing the value, which avoids SQL injection the same way a named placeholder does in Query Builder. `Raw` is the escape hatch for a condition none of the typed operators cover — you write the SQL fragment yourself, with the column alias passed in, so reach for it only when the comparison genuinely can't be expressed with the structured operators above it.

```typescript
import {
  In, Not, LessThan, LessThanOrEqual,
  MoreThan, MoreThanOrEqual, Equal,
  Like, ILike, Between, Any, IsNull, Raw
} from "typeorm";

// IN
await repository.find({ where: { id: In([1, 2, 3]) } });

// NOT
await repository.find({ where: { status: Not("deleted") } });

// Comparisons
await repository.find({ where: { age: MoreThanOrEqual(18) } });
await repository.find({ where: { price: LessThan(100) } });

// LIKE (case-sensitive)
await repository.find({ where: { email: Like("%@gmail.com") } });

// ILIKE (case-insensitive, PostgreSQL)
await repository.find({ where: { username: ILike("%john%") } });

// BETWEEN
await repository.find({ where: { age: Between(18, 65) } });

// IS NULL / IS NOT NULL
await repository.find({ where: { deletedAt: IsNull() } });
await repository.find({ where: { deletedAt: Not(IsNull()) } });

// Raw SQL
await repository.find({
  where: {
    age: Raw(alias => `${alias} > 18 AND ${alias} < 65`)
  }
});
```

### Count & Aggregations

`count()` and `exists()` cover the common cases — how many rows match, and does at least one — without loading the matching rows into memory. Anything past a plain count, like `SUM`, `AVG`, or `MIN`/`MAX`, isn't part of the repository API; you drop into Query Builder, covered next, and call `.getRawOne()` to get back a plain value instead of an entity.

```typescript
// Count
const count = await userRepository.count();
const activeCount = await userRepository.count({ where: { isActive: true } });
const countBy = await userRepository.countBy({ isActive: true });

// Exists
const exists = await userRepository.exists({ where: { email: "john@example.com" } });

// Sum, Avg, Min, Max (using QueryBuilder - see below)
const result = await userRepository
  .createQueryBuilder("user")
  .select("SUM(user.balance)", "total")
  .getRawOne();
```

* * *

## Query Builder

Find options cover straightforward conditions, but they can't express a `GROUP BY`, a correlated subquery, or a raw `SUM()`. Query Builder is TypeORM's lower-level, SQL-shaped API for exactly that — you assemble a query clause by clause, and it stays parameterized against SQL injection the same way `where` conditions do.

### Basic Query Builder

The alias string passed to `createQueryBuilder("user")` is how later clauses refer back to the table — `"user.isActive"` in the `where` clause resolves against it. `getMany()` returns an array of hydrated entities; `getRawMany()` returns plain objects with no entity mapping, which is what you need once a query selects a computed column like `COUNT(*)` that has no corresponding entity field.

```typescript
const users = await userRepository
  .createQueryBuilder("user")
  .where("user.isActive = :isActive", { isActive: true })
  .andWhere("user.age > :age", { age: 18 })
  .orderBy("user.createdAt", "DESC")
  .getMany();

// Get one
const user = await userRepository
  .createQueryBuilder("user")
  .where("user.id = :id", { id: 1 })
  .getOne();

// Get count
const count = await userRepository
  .createQueryBuilder("user")
  .where("user.isActive = :isActive", { isActive: true })
  .getCount();

// Get raw results
const raw = await userRepository
  .createQueryBuilder("user")
  .select("user.country")
  .addSelect("COUNT(*)", "count")
  .groupBy("user.country")
  .getRawMany();
```

### Joins

`leftJoinAndSelect` both joins the related table and includes its columns in the result, hydrating `post.user` in the same round trip. Plain `leftJoin` without `AndSelect` still lets you filter or group by the joined table's columns, but doesn't attach that related entity to the result — useful when you need to filter by a relation without returning it. `innerJoinAndSelect` behaves the same way but excludes rows with no match, the way a SQL `INNER JOIN` does.

```typescript
const usersWithPosts = await userRepository
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .where("user.isActive = :isActive", { isActive: true })
  .getMany();

// Join without selecting
const users = await userRepository
  .createQueryBuilder("user")
  .leftJoin("user.posts", "post")
  .where("post.published = :published", { published: true })
  .getMany();

// Inner join
const users = await userRepository
  .createQueryBuilder("user")
  .innerJoinAndSelect("user.posts", "post")
  .getMany();

// Multiple joins
const posts = await postRepository
  .createQueryBuilder("post")
  .leftJoinAndSelect("post.user", "user")
  .leftJoinAndSelect("post.comments", "comment")
  .leftJoinAndSelect("comment.author", "author")
  .getMany();
```

### Select Specific Fields

Selecting only the columns you need (`user.id`, `user.username`) cuts the data pulled over the wire — this starts to matter once a table grows a `jsonb` or `text` column nobody reads on a given screen. The second example adds computed aggregate columns (`COUNT`, `SUM`) alongside a `GROUP BY`, which only works with `getRawMany()` since the result has no matching entity shape to map onto.

```typescript
const users = await userRepository
  .createQueryBuilder("user")
  .select(["user.id", "user.username", "user.email"])
  .getMany();

// With calculations
const result = await orderRepository
  .createQueryBuilder("order")
  .select("order.userId")
  .addSelect("COUNT(order.id)", "orderCount")
  .addSelect("SUM(order.total)", "totalSpent")
  .groupBy("order.userId")
  .getRawMany();
```

### WHERE Conditions

Named parameters like `:age` prevent SQL injection the same way a prepared statement does — never concatenate user input directly into the query string. `andWhere` and `orWhere` chain onto an existing `where`, and the callback form (the bracket example below) groups a sub-expression in parentheses, which matters because `AND` binds tighter than `OR` in SQL. Without those brackets, `isActive AND country = 'USA' OR age > 65` would match any user over 65 regardless of `isActive`.

```typescript
// Parameters (prevents SQL injection)
const users = await userRepository
  .createQueryBuilder("user")
  .where("user.age > :age AND user.country = :country", {
    age: 18,
    country: "USA"
  })
  .getMany();

// Multiple where conditions
await userRepository
  .createQueryBuilder("user")
  .where("user.isActive = :isActive", { isActive: true })
  .andWhere("user.age > :age", { age: 18 })
  .getMany();

// OR conditions
await userRepository
  .createQueryBuilder("user")
  .where("user.username = :username", { username: "john" })
  .orWhere("user.email = :email", { email: "john@example.com" })
  .getMany();

// Brackets for complex logic
await userRepository
  .createQueryBuilder("user")
  .where("user.isActive = :isActive", { isActive: true })
  .andWhere(qb => {
    qb.where("user.country = :country", { country: "USA" })
      .orWhere("user.age > :age", { age: 65 });
  })
  .getMany();
// SQL: WHERE isActive = true AND (country = 'USA' OR age > 65)

// IN clause
await userRepository
  .createQueryBuilder("user")
  .where("user.id IN (:...ids)", { ids: [1, 2, 3, 4] })
  .getMany();

// LIKE
await userRepository
  .createQueryBuilder("user")
  .where("user.email LIKE :pattern", { pattern: "%@gmail.com" })
  .getMany();

// NULL checks
await userRepository
  .createQueryBuilder("user")
  .where("user.deletedAt IS NULL")
  .getMany();
```

### Pagination

`skip` and `take` map directly to SQL's `OFFSET` and `LIMIT`. `getManyAndCount()` runs the query twice internally — once for the page of rows, once as a `COUNT` — so you get both the current page and the total needed to render page numbers, without writing the count query by hand.

```typescript
const users = await userRepository
  .createQueryBuilder("user")
  .skip(20)   // OFFSET
  .take(10)   // LIMIT
  .getMany();

// With count for pagination info
const [users, total] = await userRepository
  .createQueryBuilder("user")
  .skip(20)
  .take(10)
  .getManyAndCount();

console.log(`Page 3 of ${Math.ceil(total / 10)}`);
```

### Subqueries

A subquery lets one query's `WHERE` or `SELECT` clause depend on the result of another query. The `WHERE` example below finds posts belonging to any currently active user, by checking `post.userId` against a list of active user IDs computed inline — no join required. The `SELECT` example attaches a per-row post count to each user in a single query, instead of running a separate `COUNT` query per user, which is exactly the N+1 pattern described under Performance Optimization below.

```typescript
// Subquery in WHERE
const posts = await postRepository
  .createQueryBuilder("post")
  .where(qb => {
    const subQuery = qb
      .subQuery()
      .select("user.id")
      .from(User, "user")
      .where("user.isActive = :isActive", { isActive: true })
      .getQuery();
    return "post.userId IN " + subQuery;
  })
  .getMany();

// Subquery in SELECT
const users = await userRepository
  .createQueryBuilder("user")
  .select("user.username")
  .addSelect(subQuery => {
    return subQuery
      .select("COUNT(post.id)", "count")
      .from(Post, "post")
      .where("post.userId = user.id");
  }, "postCount")
  .getRawMany();
```

### Transactions with Query Builder

Wrapping multiple Query Builder statements in `AppDataSource.transaction()` guarantees they commit or roll back together. The balance transfer below decrements one user's balance and increments another's inside the same transaction — if the second update throws, the first is undone automatically rather than leaving the books unbalanced.

```typescript
await AppDataSource.transaction(async manager => {
  await manager
    .createQueryBuilder()
    .update(User)
    .set({ balance: () => "balance - 100" })
    .where("id = :id", { id: 1 })
    .execute();

  await manager
    .createQueryBuilder()
    .update(User)
    .set({ balance: () => "balance + 100" })
    .where("id = :id", { id: 2 })
    .execute();
});
```

### Raw SQL

`AppDataSource.query()` runs a raw SQL string directly, bypassing Query Builder entirely — useful for a database-specific feature TypeORM doesn't model, like a PostgreSQL `EXPLAIN ANALYZE`. Use positional placeholders (`$1`, `$2` on PostgreSQL) rather than string interpolation, so the driver parameterizes the values instead of inlining them.

```typescript
// Execute raw query
const rawData = await AppDataSource.query(
  "SELECT * FROM users WHERE age > $1",
  [18]
);

// Using QueryBuilder
const users = await userRepository
  .createQueryBuilder("user")
  .where("user.age > :age", { age: 18 })
  .andWhere("LOWER(user.email) LIKE :pattern", { pattern: "%gmail%" })
  .getMany();
```

* * *

## Transactions

A transaction groups multiple writes so they succeed or fail as one unit. The classic example is transferring money between two accounts, where debiting one and crediting the other must either both happen or neither.

### Using Transaction Manager

`AppDataSource.transaction()` is the simplest way to run one: pass it an async callback, and every query made through the `transactionalEntityManager` it provides runs inside the same database transaction. If the callback throws — including an unhandled error from a failed `save()` — TypeORM rolls back everything the callback did and rethrows the error.

```typescript
import { AppDataSource } from "./data-source";

await AppDataSource.transaction(async (transactionalEntityManager) => {
  const user = await transactionalEntityManager.findOneBy(User, { id: 1 });
  user.balance -= 100;
  await transactionalEntityManager.save(user);

  const recipient = await transactionalEntityManager.findOneBy(User, { id: 2 });
  recipient.balance += 100;
  await transactionalEntityManager.save(recipient);

  // If any error occurs, entire transaction rolls back
});
```

### Manual Transaction Control

The `QueryRunner` API gives you explicit `commitTransaction()` / `rollbackTransaction()` calls instead of a wrapping callback, for cases where the transaction boundary doesn't map cleanly onto a single function — spanning multiple request handlers, say, or branching mid-flight on whether to commit. The `try`/`catch`/`finally` structure is mandatory here: skipping `release()` leaks a connection from the pool.

```typescript
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  const user = await queryRunner.manager.findOneBy(User, { id: 1 });
  user.balance -= 100;
  await queryRunner.manager.save(user);

  const recipient = await queryRunner.manager.findOneBy(User, { id: 2 });
  recipient.balance += 100;
  await queryRunner.manager.save(recipient);

  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}
```

### Isolation Levels

The isolation level controls how much one transaction can see of another's uncommitted or concurrently-committed changes. `SERIALIZABLE` is the strictest — it behaves as if transactions ran one at a time — and the safest choice for financial operations, at the cost of more lock contention and occasional retries under heavy concurrent writes. `READ COMMITTED`, the default on PostgreSQL, trades some of that safety for throughput by letting a transaction see rows committed by others after it started.

```typescript
await AppDataSource.transaction(
  "SERIALIZABLE",  // or "READ UNCOMMITTED", "READ COMMITTED", "REPEATABLE READ"
  async (manager) => {
    // Your transaction code
  }
);
```

* * *

## Migrations

Migrations are versioned, ordered scripts that change the database schema — each one a plain TypeScript file wrapping the SQL needed, with an `up()` (apply) and a `down()` (undo) method. They replace `synchronize: true` in any environment where you can't afford TypeORM guessing how to reconcile your entities with the live schema.

### Generate Migration

`migration:generate` diffs your current entity definitions against the database's actual schema and writes a migration file containing the SQL needed to close the gap — add a column, create an index, whatever changed. `migration:create` scaffolds an empty file instead, for changes you want to write by hand, such as a data backfill that has no entity-level equivalent.

```bash
# Generate migration from entity changes
npm run typeorm migration:generate -- -n CreateUserTable

# Create empty migration
npm run typeorm migration:create -- -n AddUserRole
```

### package.json Scripts

These scripts exist because the `typeorm` CLI needs to run through `ts-node` (via `typeorm-ts-node-commonjs`) to execute TypeScript migration files directly, without a separate compile step.

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

### Migration File

`up()` is what runs when you apply the migration; `down()` must undo exactly what `up()` did, so reverting a migration — after discovering, say, that a new column's type was wrong — restores the previous schema instead of leaving the database in a state no migration file describes. The table and column definitions below mirror the shape of `@Entity()`/`@Column()` from earlier, but written out as literal SQL schema rather than a TypeScript class.

```typescript
// src/migrations/1234567890-CreateUserTable.ts
import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateUserTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment"
          },
          {
            name: "username",
            type: "varchar",
            length: "50",
            isUnique: true
          },
          {
            name: "email",
            type: "varchar",
            length: "255",
            isUnique: true
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "now()"
          }
        ]
      }),
      true
    );

    // Create index
    await queryRunner.createIndex("users", {
      name: "IDX_USER_EMAIL",
      columnNames: ["email"]
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("users");
  }
}
```

### Add Column Migration

A narrower migration, like adding a single nullable `age` column, should still pair an `up()` with a matching `down()` — here, `addColumn` paired with `dropColumn` — even though the change is small, so the migration history stays reversible end to end.

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddUserAge1234567891 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "age",
        type: "int",
        isNullable: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "age");
  }
}
```

### Run Migrations

`migration:run` applies every migration that hasn't run yet, in filename order — which is why migration filenames are timestamp-prefixed. `migration:revert` undoes only the single most recently applied migration, not all of them, so reverting three migrations means running the command three times.

```bash
# Run all pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run typeorm migration:show
```

* * *

## Advanced Features

The features below aren't needed in every project, but when the problem fits — a recoverable delete, a self-referencing hierarchy, a cross-entity audit hook — they save you from reimplementing the same thing by hand.

### Soft Delete

A soft delete marks a row as deleted by setting a timestamp column (`@DeleteDateColumn()`) instead of removing it with `DELETE`, which keeps the row recoverable and preserves any foreign-key references from other tables that point at it. `find()` automatically excludes soft-deleted rows, so the rest of your code doesn't need to remember to filter them out — you opt back in explicitly with `withDeleted: true` for the rare case, like an admin audit view, where you need to see them.

```typescript
import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}

// Usage
await userRepository.softDelete({ id: 1 });  // Sets deletedAt
await userRepository.restore({ id: 1 });     // Clears deletedAt

// Find only active
await userRepository.find();  // Excludes soft-deleted

// Include soft-deleted
await userRepository.find({ withDeleted: true });

// Find only soft-deleted
await userRepository.find({ where: { deletedAt: Not(IsNull()) }, withDeleted: true });
```

### Entity Listeners

These decorators let an entity react to its own lifecycle without the caller needing to do anything extra. `@BeforeInsert()` below is the natural place to hash a password before it's ever written to disk, so every code path that creates a user gets the hash automatically, instead of relying on each caller to remember it.

```typescript
import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, AfterInsert, BeforeUpdate } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @BeforeInsert()
  async hashPassword() {
    // this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    console.log("About to insert user");
  }

  @AfterInsert()
  logInsert() {
    console.log(`User ${this.id} created`);
  }

  @BeforeUpdate()
  logUpdate() {
    console.log(`User ${this.id} updating`);
  }
}
```

Available listeners:
- `@BeforeInsert()`, `@AfterInsert()`
- `@BeforeUpdate()`, `@AfterUpdate()`
- `@BeforeRemove()`, `@AfterRemove()`
- `@AfterLoad()`

### Subscribers

An entity listener only ever sees one entity class; a subscriber listens across every entity, or several, through `listenTo()`. Reach for a subscriber when the same behavior needs to apply in more than one place — centralized audit logging, for example — instead of copy-pasting the same `@BeforeInsert()` into every entity that needs it.

```typescript
// src/subscribers/UserSubscriber.ts
import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from "typeorm";
import { User } from "../entities/User";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  listenTo() {
    return User;
  }

  beforeInsert(event: InsertEvent<User>) {
    console.log(`Before user inserted:`, event.entity);
  }

  afterInsert(event: InsertEvent<User>) {
    console.log(`User ${event.entity.id} inserted`);
  }
}

// Register in DataSource
export const AppDataSource = new DataSource({
  // ...
  subscribers: [UserSubscriber],
});
```

### Tree Entities (Hierarchical Data)

Tree entities model self-referential hierarchies — categories with subcategories, an org chart, a comment thread — using one of three storage strategies you pick via `@Tree(...)`: `closure-table` (a separate table recording every ancestor-descendant pair — fast to query, more storage), `materialized-path` (a string like `1/4/9` encoding the path — compact, but needs string parsing), or `nested-set` (fast reads, expensive writes, since inserting a node can require renumbering others). `findDescendants` and `findAncestors` walk the hierarchy without you writing a recursive query by hand.

```typescript
import { Entity, Column, Tree, TreeChildren, TreeParent } from "typeorm";

@Entity()
@Tree("closure-table")  // or "materialized-path", "nested-set"
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @TreeChildren()
  children: Category[];

  @TreeParent()
  parent: Category;
}

// Usage
const categoryRepository = AppDataSource.getTreeRepository(Category);

// Get tree
const trees = await categoryRepository.findTrees();

// Get descendants
const category = await categoryRepository.findOne({ where: { id: 1 } });
const descendants = await categoryRepository.findDescendants(category);

// Get ancestors
const ancestors = await categoryRepository.findAncestors(category);
```

### View Entities

A `@ViewEntity` maps a class to a SQL `VIEW` instead of a table — the `expression` becomes the view's defining query, computed by the database on every read rather than stored. It's a way to reuse a complex aggregate query, like the per-user post count below, through the same repository API as a real entity, without materializing and keeping it in sync yourself.

```typescript
import { ViewEntity, ViewColumn, DataSource } from "typeorm";

@ViewEntity({
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select("user.id", "id")
      .addSelect("user.username", "username")
      .addSelect("COUNT(post.id)", "postCount")
      .from(User, "user")
      .leftJoin(Post, "post", "post.userId = user.id")
      .groupBy("user.id")
})
export class UserPostCount {
  @ViewColumn()
  id: number;

  @ViewColumn()
  username: string;

  @ViewColumn()
  postCount: number;
}

// Usage
const stats = await AppDataSource.getRepository(UserPostCount).find();
```

* * *

## Performance Optimization

TypeORM makes it easy to write a query that returns the right answer while doing far more work than necessary. The patterns below are the ones that come up most often once a table carries real traffic.

### Eager Loading vs Lazy Loading vs Explicit Loading

Eager and lazy loading were introduced under Relationships above; explicit loading is the practical default for most code — you ask for exactly the relations a given query needs, via `relations` or `leftJoinAndSelect`, so the database does one join instead of the ORM firing a separate query per row.

```typescript
// 1. Eager loading (automatic, use sparingly)
@ManyToOne(() => User, { eager: true })
user: User;

// 2. Lazy loading (on-access, returns Promise)
@ManyToOne(() => User)
user: Promise<User>;

const post = await postRepository.findOne({ where: { id: 1 } });
const user = await post.user;  // Separate query (N+1 problem)

// 3. Explicit loading (recommended)
const posts = await postRepository.find({
  relations: ["user"]  // Single JOIN query
});

// Or with QueryBuilder
const posts = await postRepository
  .createQueryBuilder("post")
  .leftJoinAndSelect("post.user", "user")
  .getMany();
```

### Avoid N+1 Queries

The N+1 problem is what happens when you fetch a list of N parent rows and then fetch each one's related rows in a loop — one query for the list, plus N more, instead of one query total. It's easy to introduce by accident with a lazy-loaded relation, and it's the single most common TypeORM performance bug. The fix, shown below, is to ask for the relation up front with `relations: ["posts"]` or an explicit join.

```typescript
// Bad - N+1 queries
const users = await userRepository.find();
for (const user of users) {
  const posts = await postRepository.find({ where: { userId: user.id } });
  // Queries: 1 for users + N queries for posts
}

// Good - Single query with JOIN
const users = await userRepository.find({
  relations: ["posts"]
});
// Single query with JOIN

// Or use QueryBuilder
const users = await userRepository
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .getMany();
```

### Indexing

An index lets the database find matching rows without scanning the whole table, at the cost of extra work on every write to keep the index updated — so index the columns you filter or sort by often, not every column. `@Index({ unique: true })` both indexes and enforces uniqueness in one decorator. A composite index like `IDX_USER_NAME_AGE` only speeds up queries filtering on a leading prefix of its columns (`firstName`, or `firstName` plus `lastName`) — not `age` alone. A partial index, PostgreSQL-specific and built with a `where` clause, indexes only the rows matching that condition, which keeps the index small when you only ever query the subset — active users, say.

```typescript
// Single column index
@Entity()
@Index("IDX_USER_EMAIL", ["email"])
export class User {
  @Column()
  email: string;
}

// Unique index
@Entity()
export class User {
  @Column()
  @Index({ unique: true })
  email: string;
}

// Composite index
@Entity()
@Index("IDX_USER_NAME_AGE", ["firstName", "lastName", "age"])
export class User {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  age: number;
}

// Partial index (PostgreSQL)
@Entity()
@Index("IDX_ACTIVE_USERS", ["username"], { where: "is_active = true" })
export class User {
  @Column()
  username: string;

  @Column()
  isActive: boolean;
}
```

### Batch Operations

`insert()` on an array sends one multi-row `INSERT` statement instead of one round trip per row, which matters once you're inserting hundreds of records at a time. The batch update and bulk delete examples below use Query Builder directly against the table rather than loading entities into memory first — updating `isActive` for every user matching a date filter touches the database once, instead of loading each matching user, changing a field, and calling `save()` in a loop.

```typescript
// Batch insert
const users = [
  { username: "user1", email: "user1@example.com" },
  { username: "user2", email: "user2@example.com" },
  { username: "user3", email: "user3@example.com" }
];
await userRepository.insert(users);

// Batch update
await userRepository
  .createQueryBuilder()
  .update(User)
  .set({ isActive: false })
  .where("lastLogin < :date", { date: new Date("2020-01-01") })
  .execute();

// Bulk delete
await userRepository
  .createQueryBuilder()
  .delete()
  .from(User)
  .where("isActive = :isActive", { isActive: false })
  .execute();
```

### Caching

`cache: true` stores a query's result, keyed by its SQL and parameters, so an identical query within the cache window skips the database entirely. It trades a period of staleness for lower load — fine for data like a product catalog that changes rarely, risky for anything that must reflect the latest write immediately. An `id`-tagged entry, like `active_users` below, can be invalidated explicitly through `queryResultCache.remove()` the moment the underlying data changes, instead of waiting out the TTL. By default this cache lives in a database table; pointing `cache.type` at `redis` moves it to a faster, shared store when multiple app instances need to see the same cached results.

```typescript
// Enable query result caching
const users = await userRepository.find({
  where: { isActive: true },
  cache: true  // Cache for default duration
});

// Cache with custom duration (milliseconds)
const users = await userRepository.find({
  where: { isActive: true },
  cache: 60000  // 1 minute
});

// Cache with identifier (for clearing later)
const users = await userRepository.find({
  where: { isActive: true },
  cache: {
    id: "active_users",
    milliseconds: 60000
  }
});

// Clear cache
await AppDataSource.queryResultCache.remove(["active_users"]);

// Configure caching in DataSource
export const AppDataSource = new DataSource({
  // ...
  cache: {
    type: "redis",
    options: {
      host: "localhost",
      port: 6379
    }
  }
});
```

* * *

## Testing

Testing against a real, disposable database catches integration bugs — a failing foreign key, a unique-constraint violation — that a mocked repository would hide.

### Setup Test Database

A dedicated `TestDataSource` keeps test runs isolated from your development database. `dropSchema: true` combined with `synchronize: true` recreates the schema from scratch on every run, which is fine here specifically because this is a throwaway test database — the same combination on a production `DataSource`, as flagged earlier, risks destroying real data.

```typescript
// src/test-utils/setup.ts
import { DataSource } from "typeorm";
import { User } from "../entities/User";

export const TestDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "password",
  database: "test_db",
  synchronize: true,  // Auto-create tables for testing
  dropSchema: true,   // Drop schema on each run
  entities: [User],
  logging: false
});

beforeAll(async () => {
  await TestDataSource.initialize();
});

afterAll(async () => {
  await TestDataSource.destroy();
});
```

### Test Example

`beforeEach` clearing the repository ensures each test starts from a known-empty table, so one test's leftover data can't make a later test pass or fail for the wrong reason.

```typescript
// src/__tests__/user.test.ts
import { TestDataSource } from "../test-utils/setup";
import { User } from "../entities/User";

describe("User Entity", () => {
  let userRepository: Repository<User>;

  beforeAll(async () => {
    await TestDataSource.initialize();
    userRepository = TestDataSource.getRepository(User);
  });

  afterAll(async () => {
    await TestDataSource.destroy();
  });

  beforeEach(async () => {
    await userRepository.clear();  // Clear before each test
  });

  it("should create a user", async () => {
    const user = userRepository.create({
      username: "testuser",
      email: "test@example.com",
      passwordHash: "hashed"
    });

    const savedUser = await userRepository.save(user);

    expect(savedUser.id).toBeDefined();
    expect(savedUser.username).toBe("testuser");
  });

  it("should find user by email", async () => {
    await userRepository.save({
      username: "john",
      email: "john@example.com",
      passwordHash: "hashed"
    });

    const user = await userRepository.findOneBy({ email: "john@example.com" });

    expect(user).toBeDefined();
    expect(user.username).toBe("john");
  });
});
```

* * *

## Best Practices

### 1. Use synchronize: false in Production

Auto-sync is a convenience for local development, where losing data costs nothing. In production, TypeORM comparing your entities to the live schema and altering tables to match can drop a column — or its data — the moment an entity definition changes in a way TypeORM interprets differently than you intended. Migrations, covered above, give you a reviewable, reversible SQL diff instead.

```typescript
export const AppDataSource = new DataSource({
  // ...
  synchronize: process.env.NODE_ENV !== "production",  // Only in dev
});
```

### 2. Use Migrations in Production

Running `migration:run` as a deploy step means every schema change is a file in version control, reviewed in a pull request like any other code change, with the `down()` method serving as a tested rollback path if something goes wrong.

```bash
npm run migration:run
```

### 3. Explicit Column Names

Mapping `firstName` to a `first_name` column lets your database follow SQL's conventional `snake_case` naming while your TypeScript code stays `camelCase`. Without this, TypeORM creates a literal `firstName` column, which is legal but awkward to reference from raw SQL or another tool that expects `snake_case`.

```typescript
@Column({ name: "first_name" })
firstName: string;
```

### 4. Use Transactions for Related Operations

Saving a user and its profile outside a transaction means a failure between the two calls leaves a user with no profile — an inconsistent state that's visible to every other part of the app, not a temporary glitch that fixes itself.

```typescript
await AppDataSource.transaction(async manager => {
  await manager.save(user);
  await manager.save(profile);
});
```

### 5. Avoid Select *

Loading every column by default pulls in ones you don't need for a given screen or endpoint — a large `jsonb` blob, or a `passwordHash` nobody should serialize to a client. Naming the columns you actually need, as in `select: ["id", "username", "email"]` below, keeps both the query and the response payload smaller.

```typescript
// Instead of
const users = await userRepository.find();

// Use
const users = await userRepository.find({
  select: ["id", "username", "email"]
});
```

### 6. Connection Pooling

TypeORM pools connections under the hood; sizing that pool correctly for your workload is covered in the [Connection Pools & PostgreSQL Internals](./Connection%20Pools.md) guide.

### 7. Use DTOs for Input Validation

A DTO (Data Transfer Object) describes the shape of data coming from outside the application — a request body, with no guarantee it matches your entity's types or required fields — separately from the entity TypeORM manages. Validating the DTO before it reaches the repository turns a confusing database error, like a `NOT NULL` violation from a missing `username`, into a clear validation message at the point where the bad input actually entered.

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  username: string;
  email: string;
  password: string;
}

// Validate before passing to repository
```

### 8. Handle Errors Properly

PostgreSQL reports a unique-constraint violation as error code `23505` rather than a typed exception, so catching it by code and translating it into an application-level error (`"Email already exists"`) gives the caller something actionable instead of a raw driver error. Re-throw anything you don't specifically handle — swallowing unrecognized errors hides real bugs.

```typescript
try {
  await userRepository.save(user);
} catch (error) {
  if (error.code === "23505") {  // Unique violation
    throw new Error("Email already exists");
  }
  throw error;
}
```

* * *

## Common Patterns

Two patterns recur across most TypeORM codebases past the basic CRUD examples above: extending a repository with domain-specific queries, and separating business logic into a service layer.

### Repository Pattern Extension

Extending `Repository<User>` adds domain-specific query methods — `findByEmail`, `findActiveUsers` — directly onto the repository, so calling code reads `userRepository.findByEmail(...)` instead of repeating the same `where` clause at every call site. `.extend()` attaches these methods to the repository instance TypeORM already manages, rather than requiring a separate class you instantiate and wire up yourself.

```typescript
// src/repositories/UserRepository.ts
import { EntityRepository, Repository } from "typeorm";
import { User } from "../entities/User";

export class UserRepository extends Repository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.find({ where: { isActive: true } });
  }

  async getTotalBalance(): Promise<number> {
    const result = await this
      .createQueryBuilder("user")
      .select("SUM(user.balance)", "total")
      .getRawOne();
    return parseFloat(result.total) || 0;
  }
}

// Use custom repository
const userRepository = AppDataSource.getRepository(User).extend(UserRepository);
const user = await userRepository.findByEmail("john@example.com");
```

### Service Layer

A service layer sits between your route handlers and the repository, holding business rules that don't belong in either — the duplicate-email check in `createUser` below needs to run before the insert, and fits neither inside `User` itself nor inside a route handler that should stay thin. Keeping repositories simple and business logic in services is what keeps `UserService` below testable independent of the HTTP layer around it.

```typescript
// src/services/UserService.ts
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  async createUser(username: string, email: string, password: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const user = this.userRepository.create({
      username,
      email,
      passwordHash: password  // Should hash in real app
    });

    return await this.userRepository.save(user);
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ["posts", "profile"]
    });
  }
}
```

* * *

## Resources

- Official Docs: https://typeorm.io/
- GitHub: https://github.com/typeorm/typeorm
- See also: [PostgreSQL](./PostgreSQL.md), [Connection Pools & PostgreSQL Internals](./Connection%20Pools.md)
