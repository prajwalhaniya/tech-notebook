---
sidebar_position: 2
---

# TypeORM

TypeORM is a TypeScript/JavaScript ORM (Object-Relational Mapping) that can run in Node.js, Browser, Cordova, PhoneGap, Ionic, React Native, and Electron. It supports PostgreSQL, MySQL, MariaDB, SQLite, MS SQL Server, Oracle, and more.

* * *

## Installation & Setup

### Install TypeORM

```bash
# With PostgreSQL driver
npm install typeorm pg reflect-metadata

# With MySQL driver
npm install typeorm mysql2 reflect-metadata

# TypeScript support
npm install -D @types/node typescript ts-node
```

### Configure tsconfig.json

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

### Basic Entity

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

### One-to-Many / Many-to-One

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

### Basic CRUD Operations

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

More powerful than find options for complex queries.

### Basic Query Builder

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

### Using Transaction Manager

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

Migrations allow you to version-control database schema changes.

### Generate Migration

```bash
# Generate migration from entity changes
npm run typeorm migration:generate -- -n CreateUserTable

# Create empty migration
npm run typeorm migration:create -- -n AddUserRole
```

### package.json Scripts

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

### Soft Delete

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

Global event listeners across all entities.

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

### Eager Loading vs Lazy Loading vs Explicit Loading

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

### Setup Test Database

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

```typescript
export const AppDataSource = new DataSource({
  // ...
  synchronize: process.env.NODE_ENV !== "production",  // Only in dev
});
```

### 2. Use Migrations in Production

```bash
npm run migration:run
```

### 3. Explicit Column Names

```typescript
@Column({ name: "first_name" })
firstName: string;
```

### 4. Use Transactions for Related Operations

```typescript
await AppDataSource.transaction(async manager => {
  await manager.save(user);
  await manager.save(profile);
});
```

### 5. Avoid Select *

```typescript
// Instead of
const users = await userRepository.find();

// Use
const users = await userRepository.find({
  select: ["id", "username", "email"]
});
```

### 6. Connection Pooling

See the [Connection Pools & PostgreSQL Internals](./Connection Pools.md) guide.

### 7. Use DTOs for Input Validation

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

### Repository Pattern Extension

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
- See also: [PostgreSQL](./PostgreSQL.md), [Connection Pools & PostgreSQL Internals](./Connection Pools.md)
