package com.barmm.ebarmm.di

import com.barmm.ebarmm.data.repository.AuthRepositoryImpl
import com.barmm.ebarmm.data.repository.GpsTrackRepositoryImpl
import com.barmm.ebarmm.data.repository.MediaRepositoryImpl
import com.barmm.ebarmm.data.repository.ProgressRepositoryImpl
import com.barmm.ebarmm.data.repository.ProjectRepositoryImpl
import com.barmm.ebarmm.data.repository.StatsRepositoryImpl
import com.barmm.ebarmm.domain.repository.AuthRepository
import com.barmm.ebarmm.domain.repository.GpsTrackRepository
import com.barmm.ebarmm.domain.repository.MediaRepository
import com.barmm.ebarmm.domain.repository.ProgressRepository
import com.barmm.ebarmm.domain.repository.ProjectRepository
import com.barmm.ebarmm.domain.repository.StatsRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindProjectRepository(impl: ProjectRepositoryImpl): ProjectRepository

    @Binds
    @Singleton
    abstract fun bindProgressRepository(impl: ProgressRepositoryImpl): ProgressRepository

    @Binds
    @Singleton
    abstract fun bindMediaRepository(impl: MediaRepositoryImpl): MediaRepository

    @Binds
    @Singleton
    abstract fun bindStatsRepository(impl: StatsRepositoryImpl): StatsRepository

    @Binds
    @Singleton
    abstract fun bindGpsTrackRepository(impl: GpsTrackRepositoryImpl): GpsTrackRepository
}
