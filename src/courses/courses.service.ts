import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Course, CourseEnrollment } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CourseEnrollmentSearchDto } from './dto/enrollment-search.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async getCourses(page: number, search: string): Promise<Object> {
    const [courses, totalCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
          ],
        },
        skip: (page - 1) * 20,
        take: 20,
        orderBy: {
          updatedAt: 'asc',
        },
        include: {
          review: {
            select: {
              rating: true,
            },
          },
          wishlist: true,
        },
      }),
      this.prisma.course.count({}),
    ]);

    const coursesWithAverageRating = courses.map((course) => {
      const totalRatings = course.review.length;
      const averageRating = totalRatings
        ? course.review.reduce((acc, review) => acc + review.rating, 0) /
          totalRatings
        : null;

      return {
        ...course,
        averageRating,
      };
    });

    return { courses: coursesWithAverageRating, totalCourses };
  }

  async getCourseById(id: number): Promise<Course> {
    return await this.prisma.course.findUnique({
      where: { id },
    });
  }

  async getDetails(id: number): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    return course.details;
  }

  async uploadDocument(
    id: number,
    documentPath: string,
  ): Promise<Course | undefined> {
    const course = await this.prisma.course.update({
      where: { id },
      data: { details: documentPath },
    });
    return course;
  }

  async createCourse(dto: CreateCourseDto): Promise<Course | undefined> {
    const courseExist = await this.prisma.course.findUnique({
      where: { title: dto.title },
    });
    if (courseExist)
      throw new BadRequestException('Course with title already exists!');

    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        price: dto.price,
      },
    });
    if (course) return course;
    return undefined;
  }

  async getCourseTitlesAndIds() {
    const courses = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        title: 'asc',
      },
    });
    return courses;
  }

  async updateCourse(
    id: number,
    dto: UpdateCourseDto,
  ): Promise<Course | undefined> {
    const courseExist = await this.prisma.course.findUnique({
      where: { id, title: dto.title },
    });
    if (courseExist) dto.title = undefined;

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        price: dto.price || undefined,
        title: dto.title || undefined,
      },
    });

    if (course) return course;
    return undefined;
  }

  async deleteCourse(id: number): Promise<Course | undefined> {
    return await this.prisma.course.delete({
      where: { id },
    });
  }

  async coursePayments(
    page: number,
    dto: CourseEnrollmentSearchDto,
  ): Promise<Object> {
    const where = {};
    if (dto.search) {
      where['course'] = {
        title: {
          contains: dto.search,
          mode: 'insensitive',
        },
      };
    }

    if (dto.status) {
      where['status'] = {
        equals: dto.status,
      };
    }

    const [payments, totalPayments] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where,
        include: {
          student: true,
          course: true,
        },
        skip: 30 * (page - 1),
        take: 30,
        orderBy: {
          dateEnrolled: 'asc',
        },
      }),
      await this.prisma.courseEnrollment.count({}),
    ]);
    return { payments, totalPayments };
  }

  async courseStatusUpdate(
    page: number,
    dto: UpdateStatusDto,
  ): Promise<CourseEnrollment[] | undefined> {
    await this.prisma.courseEnrollment.updateMany({
      where: {
        courseId: dto.courseId,
      },
      data: {
        status: dto.status,
      },
    });
    return await this.prisma.courseEnrollment.findMany({
      skip: 30 * (page - 1),
      take: 30,
      orderBy: {
        dateEnrolled: 'asc',
      },
      include: {
        student: true,
        course: true,
      },
    });
  }
}
