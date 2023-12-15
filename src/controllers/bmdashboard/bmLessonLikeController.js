// const likeLesson = async (lessonId, userId) => {
//   // Check if the user has already liked the lesson
//   const existingLike = await Like.findOne({ user: userId, lesson: lessonId });

//   if (existingLike) {
//     // User has already liked the lesson, handle unlike or show a message
//     // You may want to throw an error or handle this case based on your requirements
//     return { message: 'User has already liked the lesson' };
//   }

//   // Create a new like
//   const newLike = new Like({ user: userId });
//   await newLike.save();

//   // Update the lesson's likes array
//   await Lesson.findByIdAndUpdate(lessonId, { $push: { likes: newLike._id } });

//   return { message: 'Lesson liked successfully' };
// };