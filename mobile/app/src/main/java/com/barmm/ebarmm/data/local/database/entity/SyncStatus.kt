package com.barmm.ebarmm.data.local.database.entity

enum class SyncStatus {
    PENDING,
    SYNCING,
    SYNCED,
    FAILED
}

enum class OperationType {
    CREATE,
    UPDATE,
    DELETE
}

enum class EntityType {
    PROGRESS,
    MEDIA
}
