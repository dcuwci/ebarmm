package com.barmm.ebarmm.core.security

import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HashCalculator @Inject constructor() {

    fun calculateProgressHash(
        projectId: String,
        description: String,
        percentage: Double,
        previousHash: String?
    ): String {
        val input = buildString {
            append(projectId)
            append(description)
            append(percentage.toString())
            if (previousHash != null) {
                append(previousHash)
            }
        }

        return sha256(input)
    }

    private fun sha256(input: String): String {
        val bytes = input.toByteArray()
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(bytes)
        return hash.joinToString("") { "%02x".format(it) }
    }
}
