-- ============================================================
-- مصنعي (Masna3i) - Factory ERP System
-- Complete Database Schema - Version 1.0
-- MySQL 8.0+ / InnoDB / UTF8MB4
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT,
  `group` VARCHAR(50) DEFAULT 'general',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `display_name` VARCHAR(100),
  `permissions` JSON,
  `is_system` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100),
  `phone` VARCHAR(20),
  `role_id` INT UNSIGNED NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PRODUCTS & MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('product','material') NOT NULL,
  `parent_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_parent_id` (`parent_id`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `abbreviation` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_unit_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `raw_materials` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `category_id` INT UNSIGNED NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `current_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `description` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_unit_id` (`unit_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_materials_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_materials_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50),
  `category_id` INT UNSIGNED NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `current_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `barcode` VARCHAR(50),
  `image` VARCHAR(255),
  `description` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku` (`sku`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_unit_id` (`unit_id`),
  KEY `idx_barcode` (`barcode`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_sizes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `size_label` VARCHAR(50) NOT NULL,
  `size_value` DECIMAL(10,3),
  `unit_id` INT UNSIGNED NOT NULL,
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `barcode` VARCHAR(50),
  `current_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_unit_id` (`unit_id`),
  KEY `idx_barcode` (`barcode`),
  CONSTRAINT `fk_psizes_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_psizes_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- RECIPES (BILL OF MATERIALS)
-- ============================================================

CREATE TABLE IF NOT EXISTS `recipes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `output_quantity` DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  `output_unit_id` INT UNSIGNED NOT NULL,
  `notes` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  CONSTRAINT `fk_recipes_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_recipes_unit` FOREIGN KEY (`output_unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipe_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipe_id` INT UNSIGNED NOT NULL,
  `material_id` INT UNSIGNED NOT NULL,
  `quantity` DECIMAL(12,4) NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `waste_percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_recipe_id` (`recipe_id`),
  KEY `idx_material_id` (`material_id`),
  CONSTRAINT `fk_ritems_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ritems_material` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`id`),
  CONSTRAINT `fk_ritems_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PRODUCTION
-- ============================================================

CREATE TABLE IF NOT EXISTS `production_orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(30) NOT NULL,
  `recipe_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `product_size_id` INT UNSIGNED NULL,
  `planned_quantity` DECIMAL(12,3) NOT NULL,
  `actual_quantity` DECIMAL(12,3) NULL,
  `status` ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
  `planned_date` DATE NOT NULL,
  `start_date` DATETIME NULL,
  `end_date` DATETIME NULL,
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  KEY `idx_recipe_id` (`recipe_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_product_size_id` (`product_size_id`),
  KEY `idx_status` (`status`),
  KEY `idx_planned_date` (`planned_date`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_prodord_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`),
  CONSTRAINT `fk_prodord_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_prodord_size` FOREIGN KEY (`product_size_id`) REFERENCES `product_sizes` (`id`),
  CONSTRAINT `fk_prodord_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `production_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `production_order_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `quantity` DECIMAL(12,3),
  `notes` TEXT,
  `performed_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_production_order_id` (`production_order_id`),
  KEY `idx_performed_by` (`performed_by`),
  CONSTRAINT `fk_prodlog_order` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders` (`id`),
  CONSTRAINT `fk_prodlog_user` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `location` VARCHAR(255),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('in','out','transfer','adjustment') NOT NULL,
  `reference_type` ENUM('production','sale','purchase','return','adjustment','transfer') NOT NULL,
  `reference_id` INT UNSIGNED NULL,
  `item_type` ENUM('product','material') NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `product_size_id` INT UNSIGNED NULL,
  `warehouse_id` INT UNSIGNED NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_reference` (`reference_type`, `reference_id`),
  KEY `idx_item` (`item_type`, `item_id`),
  KEY `idx_product_size_id` (`product_size_id`),
  KEY `idx_warehouse_id` (`warehouse_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_invmov_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_invmov_size` FOREIGN KEY (`product_size_id`) REFERENCES `product_sizes` (`id`),
  CONSTRAINT `fk_invmov_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CUSTOMERS & SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('wholesale','retail','distributor') NOT NULL DEFAULT 'retail',
  `company_name` VARCHAR(150),
  `phone` VARCHAR(20),
  `phone2` VARCHAR(20),
  `email` VARCHAR(100),
  `address` TEXT,
  `city` VARCHAR(50),
  `tax_number` VARCHAR(30),
  `credit_limit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_phone` (`phone`),
  KEY `idx_city` (`city`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `company_name` VARCHAR(150),
  `phone` VARCHAR(20),
  `phone2` VARCHAR(20),
  `email` VARCHAR(100),
  `address` TEXT,
  `city` VARCHAR(50),
  `tax_number` VARCHAR(30),
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(30) NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `delivery_date` DATE NULL,
  `status` ENUM('draft','confirmed','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_delivery_date` (`delivery_date`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_salesord_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_salesord_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sales_order_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `product_size_id` INT UNSIGNED NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `total_price` DECIMAL(12,2) NOT NULL,
  `notes` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_sales_order_id` (`sales_order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_product_size_id` (`product_size_id`),
  CONSTRAINT `fk_soitems_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_soitems_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_soitems_size` FOREIGN KEY (`product_size_id`) REFERENCES `product_sizes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_returns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `return_number` VARCHAR(30) NOT NULL,
  `sales_order_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `return_date` DATE NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reason` TEXT,
  `status` ENUM('pending','approved','completed') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_return_number` (`return_number`),
  KEY `idx_sales_order_id` (`sales_order_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_return_date` (`return_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_sret_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`),
  CONSTRAINT `fk_sret_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_sret_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(30) NOT NULL,
  `supplier_id` INT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_date` DATE NULL,
  `status` ENUM('draft','confirmed','received','partial','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  KEY `idx_supplier_id` (`supplier_id`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_expected_date` (`expected_date`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_purchord_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_purchord_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id` INT UNSIGNED NOT NULL,
  `material_id` INT UNSIGNED NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `received_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `total_price` DECIMAL(12,2) NOT NULL,
  `notes` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_order_id` (`purchase_order_id`),
  KEY `idx_material_id` (`material_id`),
  CONSTRAINT `fk_poitems_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_poitems_material` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `return_number` VARCHAR(30) NOT NULL,
  `purchase_order_id` INT UNSIGNED NOT NULL,
  `supplier_id` INT UNSIGNED NOT NULL,
  `return_date` DATE NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reason` TEXT,
  `status` ENUM('pending','approved','completed') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_return_number` (`return_number`),
  KEY `idx_purchase_order_id` (`purchase_order_id`),
  KEY `idx_supplier_id` (`supplier_id`),
  KEY `idx_return_date` (`return_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_pret_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `fk_pret_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_pret_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ACCOUNTING (DOUBLE-ENTRY BOOKKEEPING)
-- ============================================================

CREATE TABLE IF NOT EXISTS `account_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `nature` ENUM('debit','credit') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `account_type_id` INT UNSIGNED NOT NULL,
  `parent_id` INT UNSIGNED NULL,
  `level` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `is_parent` TINYINT(1) NOT NULL DEFAULT 0,
  `description` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_account_type_id` (`account_type_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_level` (`level`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_coa_type` FOREIGN KEY (`account_type_id`) REFERENCES `account_types` (`id`),
  CONSTRAINT `fk_coa_parent` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fiscal_years` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_closed` TINYINT(1) NOT NULL DEFAULT 0,
  `closed_by` INT UNSIGNED NULL,
  `closed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dates` (`start_date`, `end_date`),
  KEY `idx_is_closed` (`is_closed`),
  CONSTRAINT `fk_fy_closer` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entry_number` VARCHAR(30) NOT NULL,
  `fiscal_year_id` INT UNSIGNED NOT NULL,
  `entry_date` DATE NOT NULL,
  `description` TEXT NOT NULL,
  `reference_type` ENUM('sale','purchase','payment','receipt','expense','salary','adjustment','opening','depreciation','transfer') NULL,
  `reference_id` INT UNSIGNED NULL,
  `is_posted` TINYINT(1) NOT NULL DEFAULT 0,
  `posted_by` INT UNSIGNED NULL,
  `posted_at` TIMESTAMP NULL,
  `total_debit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_credit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_entry_number` (`entry_number`),
  KEY `idx_fiscal_year_id` (`fiscal_year_id`),
  KEY `idx_entry_date` (`entry_date`),
  KEY `idx_reference` (`reference_type`, `reference_id`),
  KEY `idx_is_posted` (`is_posted`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_je_fiscal` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`),
  CONSTRAINT `fk_je_poster` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_je_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entry_lines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `journal_entry_id` INT UNSIGNED NOT NULL,
  `account_id` INT UNSIGNED NOT NULL,
  `debit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `credit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `description` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journal_entry_id` (`journal_entry_id`),
  KEY `idx_account_id` (`account_id`),
  CONSTRAINT `fk_jel_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jel_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`),
  CONSTRAINT `chk_debit_or_credit` CHECK (`debit` >= 0 AND `credit` >= 0 AND NOT (`debit` > 0 AND `credit` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `account_id` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_method_name` (`name`),
  KEY `idx_account_id` (`account_id`),
  CONSTRAINT `fk_pm_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_number` VARCHAR(30) NOT NULL,
  `type` ENUM('received','made') NOT NULL,
  `related_type` ENUM('sale','purchase','expense','salary','other') NOT NULL,
  `related_id` INT UNSIGNED NULL,
  `payment_method_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `reference` VARCHAR(100),
  `journal_entry_id` INT UNSIGNED NULL,
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_number` (`payment_number`),
  KEY `idx_type` (`type`),
  KEY `idx_related` (`related_type`, `related_id`),
  KEY `idx_payment_method_id` (`payment_method_id`),
  KEY `idx_payment_date` (`payment_date`),
  KEY `idx_journal_entry_id` (`journal_entry_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_pay_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_pay_journal` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`),
  CONSTRAINT `fk_pay_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `expense_number` VARCHAR(30) NOT NULL,
  `category` ENUM('rent','utilities','fuel','maintenance','supplies','marketing','other') NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `payment_method_id` INT UNSIGNED NOT NULL,
  `account_id` INT UNSIGNED NOT NULL,
  `journal_entry_id` INT UNSIGNED NULL,
  `notes` TEXT,
  `receipt_image` VARCHAR(255),
  `created_by` INT UNSIGNED NOT NULL,
  `approved_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_expense_number` (`expense_number`),
  KEY `idx_category` (`category`),
  KEY `idx_expense_date` (`expense_date`),
  KEY `idx_payment_method_id` (`payment_method_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_journal_entry_id` (`journal_entry_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_exp_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_exp_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`),
  CONSTRAINT `fk_exp_journal` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`),
  CONSTRAINT `fk_exp_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exp_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cash_register` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `closing_balance` DECIMAL(12,2) NULL,
  `date` DATE NOT NULL,
  `opened_by` INT UNSIGNED NOT NULL,
  `closed_by` INT UNSIGNED NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `fk_cr_opener` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cr_closer` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ASSETS
-- ============================================================

CREATE TABLE IF NOT EXISTS `assets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `category` ENUM('machinery','vehicle','equipment','furniture','other') NOT NULL,
  `purchase_date` DATE NOT NULL,
  `purchase_cost` DECIMAL(12,2) NOT NULL,
  `useful_life_months` INT UNSIGNED NOT NULL,
  `salvage_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `depreciation_method` ENUM('straight_line','declining_balance') NOT NULL DEFAULT 'straight_line',
  `current_value` DECIMAL(12,2) NOT NULL,
  `account_id` INT UNSIGNED NULL,
  `notes` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_purchase_date` (`purchase_date`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_asset_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_depreciation` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `asset_id` INT UNSIGNED NOT NULL,
  `period_date` DATE NOT NULL,
  `depreciation_amount` DECIMAL(12,2) NOT NULL,
  `accumulated_depreciation` DECIMAL(12,2) NOT NULL,
  `book_value` DECIMAL(12,2) NOT NULL,
  `journal_entry_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_period_date` (`period_date`),
  KEY `idx_journal_entry_id` (`journal_entry_id`),
  CONSTRAINT `fk_adep_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_adep_journal` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- HR
-- ============================================================

CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `manager_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_manager_id` (`manager_id`),
  CONSTRAINT `fk_dept_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `name` VARCHAR(100) NOT NULL,
  `department_id` INT UNSIGNED NULL,
  `position` VARCHAR(100),
  `phone` VARCHAR(20),
  `address` TEXT,
  `national_id` VARCHAR(20),
  `hire_date` DATE NOT NULL,
  `base_salary` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `salary_type` ENUM('monthly','daily','hourly') NOT NULL DEFAULT 'monthly',
  `bank_account` VARCHAR(30),
  `emergency_contact` VARCHAR(100),
  `notes` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_national_id` (`national_id`),
  KEY `idx_hire_date` (`hire_date`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` INT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  `check_in` TIME NULL,
  `check_out` TIME NULL,
  `status` ENUM('present','absent','late','leave','holiday') NOT NULL DEFAULT 'present',
  `overtime_hours` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_emp_date` (`employee_id`, `date`),
  KEY `idx_date` (`date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_att_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` INT UNSIGNED NOT NULL,
  `month` TINYINT UNSIGNED NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `base_salary` DECIMAL(10,2) NOT NULL,
  `overtime_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `bonuses` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `deductions` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `advances` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `net_salary` DECIMAL(10,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method_id` INT UNSIGNED NOT NULL,
  `journal_entry_id` INT UNSIGNED NULL,
  `notes` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_emp_month_year` (`employee_id`, `month`, `year`),
  KEY `idx_month_year` (`year`, `month`),
  KEY `idx_payment_date` (`payment_date`),
  KEY `idx_journal_entry_id` (`journal_entry_id`),
  CONSTRAINT `fk_sal_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_sal_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_sal_journal` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`),
  CONSTRAINT `fk_sal_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_advances` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `advance_date` DATE NOT NULL,
  `deduct_from_month` TINYINT UNSIGNED NOT NULL,
  `deduct_from_year` SMALLINT UNSIGNED NOT NULL,
  `is_deducted` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT,
  `approved_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `idx_advance_date` (`advance_date`),
  KEY `idx_deduct_period` (`deduct_from_year`, `deduct_from_month`),
  KEY `idx_is_deducted` (`is_deducted`),
  CONSTRAINT `fk_adv_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_adv_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- QUALITY
-- ============================================================

CREATE TABLE IF NOT EXISTS `quality_standards` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('material','product') NOT NULL,
  `min_value` DECIMAL(10,4),
  `max_value` DECIMAL(10,4),
  `unit` VARCHAR(20),
  `description` TEXT,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quality_checks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `check_number` VARCHAR(30) NOT NULL,
  `type` ENUM('incoming','outgoing','in_process') NOT NULL,
  `reference_type` ENUM('purchase','production','sale') NOT NULL,
  `reference_id` INT UNSIGNED NULL,
  `item_type` ENUM('product','material') NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `checked_by` INT UNSIGNED NOT NULL,
  `check_date` DATE NOT NULL,
  `result` ENUM('pass','fail','conditional') NOT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_check_number` (`check_number`),
  KEY `idx_type` (`type`),
  KEY `idx_reference` (`reference_type`, `reference_id`),
  KEY `idx_item` (`item_type`, `item_id`),
  KEY `idx_check_date` (`check_date`),
  KEY `idx_result` (`result`),
  CONSTRAINT `fk_qc_checker` FOREIGN KEY (`checked_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quality_check_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quality_check_id` INT UNSIGNED NOT NULL,
  `standard_id` INT UNSIGNED NOT NULL,
  `measured_value` DECIMAL(10,4),
  `result` ENUM('pass','fail') NOT NULL,
  `notes` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_quality_check_id` (`quality_check_id`),
  KEY `idx_standard_id` (`standard_id`),
  CONSTRAINT `fk_qci_check` FOREIGN KEY (`quality_check_id`) REFERENCES `quality_checks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qci_standard` FOREIGN KEY (`standard_id`) REFERENCES `quality_standards` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ACTIVITY & NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED NULL,
  `details` JSON,
  `ip_address` VARCHAR(45),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_entity` (`entity_type`, `entity_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_action` (`action`),
  CONSTRAINT `fk_actlog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'info',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `link` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default settings
INSERT INTO `settings` (`key`, `value`) VALUES
('factory_name', 'مصنعي'),
('currency', 'SAR'),
('currency_symbol', 'ر.س'),
('tax_rate', '15'),
('tax_name', 'ضريبة القيمة المضافة'),
('date_format', 'YYYY-MM-DD'),
('fiscal_year_start', '01-01'),
('default_warehouse', '1'),
('low_stock_alert', '1'),
('auto_post_journal', '0'),
('company_address', ''),
('company_phone', ''),
('company_email', ''),
('company_tax_number', ''),
('company_logo', ''),
('invoice_prefix', 'INV-'),
('purchase_prefix', 'PO-'),
('production_prefix', 'PRD-'),
('payment_prefix', 'PAY-'),
('expense_prefix', 'EXP-');

-- Default roles
INSERT INTO `roles` (`id`, `name`, `display_name`, `permissions`, `is_system`) VALUES
(1, 'admin', 'مدير النظام', '["*"]', TRUE),
(2, 'accountant', 'محاسب', '["sales.*","purchases.*","customers.*","suppliers.*","accounting.*","expenses.*","payments.*","reports.*","hr.salaries.*","assets.*","inventory.view","products.view"]', TRUE),
(3, 'production_supervisor', 'مشرف إنتاج', '["production.*","inventory.*","quality.*","products.view","materials.*","recipes.*","reports.production"]', TRUE),
(4, 'worker', 'عامل', '["production.view","production.log","inventory.view","quality.create","attendance.self"]', TRUE),
(5, 'sales_rep', 'مندوب مبيعات', '["sales.*","customers.*","products.view","inventory.view","reports.sales"]', TRUE);

-- Default admin user (password: admin123 hashed with bcrypt)
INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `email`, `role_id`) VALUES
(1, 'admin', '$2a$10$hNXsjyGwLA3HoeAN6R5cCuyL0XTxpK6V8Yu9pZ17GnuvwPBTbrXNa', 'مدير النظام', 'admin@masna3i.com', 1);

-- Default units
INSERT INTO `units` (`id`, `name`, `abbreviation`) VALUES
(1, 'كيلو', 'كجم'),
(2, 'جرام', 'جم'),
(3, 'لتر', 'لتر'),
(4, 'مللي لتر', 'مل'),
(5, 'قطعة', 'قطعة'),
(6, 'كرتونة', 'كرتون'),
(7, 'طن', 'طن'),
(8, 'عبوة', 'عبوة');

-- Default warehouse
INSERT INTO `warehouses` (`id`, `name`, `location`, `is_active`) VALUES
(1, 'المستودع الرئيسي', 'المصنع', 1);

-- ============================================================
-- ACCOUNT TYPES (5 Standard Types)
-- ============================================================

INSERT INTO `account_types` (`id`, `name`, `nature`) VALUES
(1, 'أصول', 'debit'),
(2, 'خصوم', 'credit'),
(3, 'حقوق ملكية', 'credit'),
(4, 'إيرادات', 'credit'),
(5, 'مصروفات', 'debit');

-- ============================================================
-- CHART OF ACCOUNTS (Complete Arabic Tree for Factory)
-- ============================================================

-- ===================== LEVEL 1: Main Groups =====================

INSERT INTO `chart_of_accounts` (`id`, `code`, `name`, `account_type_id`, `parent_id`, `level`, `is_parent`, `is_system`, `is_active`) VALUES
(1,  '1000', 'الأصول', 1, NULL, 1, 1, 1, 1),
(2,  '2000', 'الخصوم', 2, NULL, 1, 1, 1, 1),
(3,  '3000', 'حقوق الملكية', 3, NULL, 1, 1, 1, 1),
(4,  '4000', 'الإيرادات', 4, NULL, 1, 1, 1, 1),
(5,  '5000', 'المصروفات', 5, NULL, 1, 1, 1, 1);

-- ===================== LEVEL 2: Sub-Groups =====================

INSERT INTO `chart_of_accounts` (`id`, `code`, `name`, `account_type_id`, `parent_id`, `level`, `is_parent`, `is_system`, `is_active`) VALUES
(10, '1100', 'الأصول المتداولة', 1, 1, 2, 1, 1, 1),
(11, '1200', 'الأصول الثابتة', 1, 1, 2, 1, 1, 1),
(20, '2100', 'الخصوم المتداولة', 2, 2, 2, 1, 1, 1),
(21, '2200', 'الخصوم طويلة الأجل', 2, 2, 2, 1, 1, 1),
(30, '3100', 'رأس المال', 3, 3, 2, 0, 1, 1),
(31, '3200', 'الأرباح المحتجزة', 3, 3, 2, 0, 1, 1),
(32, '3300', 'أرباح / خسائر العام', 3, 3, 2, 0, 1, 1),
(40, '4100', 'إيرادات المبيعات', 4, 4, 2, 1, 1, 1),
(41, '4200', 'إيرادات أخرى', 4, 4, 2, 0, 1, 1),
(50, '5100', 'تكلفة البضاعة المباعة', 5, 5, 2, 1, 1, 1),
(51, '5200', 'مصروفات تشغيلية', 5, 5, 2, 1, 1, 1),
(52, '5300', 'مصروفات إدارية', 5, 5, 2, 1, 1, 1),
(53, '5400', 'مصروفات تسويقية', 5, 5, 2, 1, 1, 1),
(54, '5500', 'مصروفات مالية', 5, 5, 2, 0, 1, 1);

-- ===================== LEVEL 3: Leaf Accounts =====================

INSERT INTO `chart_of_accounts` (`id`, `code`, `name`, `account_type_id`, `parent_id`, `level`, `is_parent`, `is_system`, `is_active`) VALUES
-- Current Assets
(100, '1101', 'الصندوق (النقدية)', 1, 10, 3, 0, 1, 1),
(101, '1102', 'البنك', 1, 10, 3, 0, 1, 1),
(102, '1103', 'ذمم العملاء (المدينون)', 1, 10, 3, 0, 1, 1),
(103, '1104', 'مخزون المواد الخام', 1, 10, 3, 0, 1, 1),
(104, '1105', 'مخزون المنتجات التامة', 1, 10, 3, 0, 1, 1),
(105, '1106', 'إنتاج تحت التشغيل', 1, 10, 3, 0, 1, 1),
(106, '1107', 'سلف الموظفين', 1, 10, 3, 0, 1, 1),
(107, '1108', 'مصروفات مدفوعة مقدما', 1, 10, 3, 0, 1, 1),
(108, '1109', 'شيكات تحت التحصيل', 1, 10, 3, 0, 1, 1),
(109, '1110', 'ضريبة القيمة المضافة - مدخلات', 1, 10, 3, 0, 1, 1),
-- Fixed Assets
(110, '1201', 'الآلات والمعدات', 1, 11, 3, 0, 1, 1),
(111, '1202', 'مجمع إهلاك الآلات', 1, 11, 3, 0, 1, 1),
(112, '1203', 'السيارات', 1, 11, 3, 0, 1, 1),
(113, '1204', 'مجمع إهلاك السيارات', 1, 11, 3, 0, 1, 1),
(114, '1205', 'الأثاث والتجهيزات', 1, 11, 3, 0, 1, 1),
(115, '1206', 'مجمع إهلاك الأثاث', 1, 11, 3, 0, 1, 1),
(116, '1207', 'المباني', 1, 11, 3, 0, 1, 1),
(117, '1208', 'مجمع إهلاك المباني', 1, 11, 3, 0, 1, 1),
-- Current Liabilities
(200, '2101', 'ذمم الموردين (الدائنون)', 2, 20, 3, 0, 1, 1),
(201, '2102', 'رواتب مستحقة', 2, 20, 3, 0, 1, 1),
(202, '2103', 'ضريبة القيمة المضافة - مخرجات', 2, 20, 3, 0, 1, 1),
(203, '2104', 'مصروفات مستحقة', 2, 20, 3, 0, 1, 1),
(204, '2105', 'دفعات عملاء مقدمة', 2, 20, 3, 0, 1, 1),
(205, '2106', 'شيكات مستحقة الدفع', 2, 20, 3, 0, 1, 1),
-- Long-term Liabilities
(210, '2201', 'قروض طويلة الأجل', 2, 21, 3, 0, 1, 1),
-- Sales Revenue
(400, '4101', 'مبيعات منتجات', 4, 40, 3, 0, 1, 1),
(401, '4102', 'مردودات مبيعات', 4, 40, 3, 0, 1, 1),
(402, '4103', 'خصومات مبيعات', 4, 40, 3, 0, 1, 1),
-- Cost of Goods Sold
(500, '5101', 'تكلفة المواد الخام المستخدمة', 5, 50, 3, 0, 1, 1),
(501, '5102', 'تكلفة العمالة المباشرة', 5, 50, 3, 0, 1, 1),
(502, '5103', 'تكاليف تصنيع غير مباشرة', 5, 50, 3, 0, 1, 1),
(503, '5104', 'هالك الإنتاج', 5, 50, 3, 0, 1, 1),
-- Operating Expenses
(510, '5201', 'إيجارات', 5, 51, 3, 0, 1, 1),
(511, '5202', 'كهرباء ومياه', 5, 51, 3, 0, 1, 1),
(512, '5203', 'وقود ومحروقات', 5, 51, 3, 0, 1, 1),
(513, '5204', 'صيانة وإصلاحات', 5, 51, 3, 0, 1, 1),
(514, '5205', 'مستلزمات تشغيل', 5, 51, 3, 0, 1, 1),
(515, '5206', 'نقل وشحن', 5, 51, 3, 0, 1, 1),
(516, '5207', 'إهلاك الأصول الثابتة', 5, 51, 3, 0, 1, 1),
-- Admin Expenses
(520, '5301', 'رواتب وأجور', 5, 52, 3, 0, 1, 1),
(521, '5302', 'تأمينات اجتماعية', 5, 52, 3, 0, 1, 1),
(522, '5303', 'مكافآت وحوافز', 5, 52, 3, 0, 1, 1),
(523, '5304', 'مصروفات مكتبية', 5, 52, 3, 0, 1, 1),
(524, '5305', 'اتصالات وإنترنت', 5, 52, 3, 0, 1, 1),
(525, '5306', 'رسوم وتراخيص حكومية', 5, 52, 3, 0, 1, 1),
-- Marketing Expenses
(530, '5401', 'إعلانات وتسويق', 5, 53, 3, 0, 1, 1),
(531, '5402', 'عمولات مبيعات', 5, 53, 3, 0, 1, 1),
-- Financial Expenses
(540, '5501', 'عمولات بنكية', 5, 54, 3, 0, 0, 1),
(541, '5502', 'فوائد قروض', 5, 54, 3, 0, 0, 1);

-- ============================================================
-- DEFAULT PAYMENT METHODS (linked to chart_of_accounts)
-- ============================================================

INSERT INTO `payment_methods` (`id`, `name`, `account_id`) VALUES
(1, 'نقدي', 100),
(2, 'تحويل بنكي', 101),
(3, 'شيك', 108);

-- ============================================================
-- DEFAULT FISCAL YEAR
-- ============================================================

INSERT INTO `fiscal_years` (`id`, `name`, `start_date`, `end_date`, `is_closed`) VALUES
(1, 'السنة المالية 2026', '2026-01-01', '2026-12-31', 0);

-- ============================================================
-- DEFAULT DEPARTMENTS
-- ============================================================

INSERT INTO `departments` (`id`, `name`, `manager_id`) VALUES
(1, 'الإدارة', 1),
(2, 'الإنتاج', NULL),
(3, 'المبيعات', NULL),
(4, 'المحاسبة', NULL),
(5, 'المستودعات', NULL),
(6, 'الجودة', NULL);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
